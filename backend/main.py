from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import text

from services.trip_service import (
    get_trip_category,
    get_travel_season,
    get_transport_category,
    calculate_daily_budget,
)
from services.bedrock_service import get_ai_recommendations
from database import Base, engine, get_db, check_db_connection
from models.trip import Trip

import logging
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once on startup — safe to fail here without crashing the import
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Warning: Could not create tables on startup: {e}")
    yield
    # Runs on shutdown (nothing to clean up for now)

app = FastAPI(
    title="KelanaAI",
    description="AI-powered travel planning API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── STATIC DATA ──────────────────────────────────────────────────────────────

RECOMMENDATIONS = ["Tokyo Tower", "Mount Fuji", "Shibuya"]
TRANSPORTATIONS = ["Bus", "Train", "Flight"]
TRIP_CATEGORIES = [
    {"name": "Backpacker", "budget_range": "below 1,000"},
    {"name": "Standard",   "budget_range": "1,000 – 3,000"},
    {"name": "Luxury",     "budget_range": "above 3,000"},
]


# ─── SCHEMAS ──────────────────────────────────────────────────────────────────

class TripRequest(BaseModel):
    destination:  str
    days:         int   = Field(gt=0, description="Number of travel days")
    budget:       float = Field(gt=0, description="Total trip budget")
    currency:     str   = "USD"
    travel_style: Optional[str] = None
    travel_month: Optional[str] = None

class BudgetRequest(BaseModel):
    budget: float = Field(gt=0)

class BudgetUpdateRequest(BaseModel):
    budget: float = Field(gt=0, description="New budget to update and recalculate from")


# ─── SHARED HELPERS ───────────────────────────────────────────────────────────

def compute_trip_fields(budget: float, days: int, travel_month: Optional[str]) -> dict:
    """Central place for all derived field calculations."""
    return {
        "category":                 get_trip_category(budget),
        "recommendation_transport": get_transport_category(budget),
        "daily_budget":             round(calculate_daily_budget(budget, days), 2),
        "travel_season":            get_travel_season(travel_month) if travel_month else None,
    }


def _db_commit(db: Session, error_msg: str):
    """Commit with automatic rollback on failure."""
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"{error_msg}: {str(e)}")


def _call_bedrock(trip: Trip) -> str:
    """
    Calls Amazon Bedrock using all available trip context.
    Returns the AI-generated itinerary as a string.
    """
    try:
        logger.info(f"Calling Bedrock for trip_id={trip.id}, destination={trip.destination}")
        result = get_ai_recommendations(
            destination              = trip.destination,
            days                     = trip.days,
            budget                   = trip.budget,
            travel_style             = trip.travel_style or "general",
            travel_month             = trip.travel_month,
            travel_season            = trip.travel_season,
            category                 = trip.category,
            daily_budget             = trip.daily_budget,
            recommendation_transport = trip.recommendation_transport,
        )
        logger.info(f"Bedrock response length: {len(result) if result else 0} chars")
        if not result:
            raise ValueError("Bedrock returned an empty response")
        return result
    except ValueError as e:
        logger.error(f"Bedrock ValueError: {e}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Bedrock Exception: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"Bedrock error: {str(e)}")


def _generate_and_save(db: Session, trip: Trip, strict: bool = True) -> None:
    """
    Generates the AI itinerary for `trip` and persists it to ai_recommendation.

    strict=True  -> Bedrock/DB failures propagate as HTTP errors (explicit /generate call).
    strict=False -> failures are logged and the trip is left with a null
                    recommendation, so a Bedrock outage never blocks saving a trip.
    """
    try:
        itinerary = _call_bedrock(trip)
    except HTTPException:
        if strict:
            raise
        logger.warning(f"Skipping ai_recommendation for trip_id={trip.id}: Bedrock unavailable")
        return

    trip.ai_recommendation = itinerary
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save ai_recommendation for trip_id={trip.id}: {e}")
        if strict:
            raise HTTPException(status_code=500, detail=f"Failed to save recommendation: {str(e)}")
        return

    db.refresh(trip)
    logger.info(f"Saved ai_recommendation for trip_id={trip.id} ({len(itinerary)} chars)")


def _trip_response(trip: Trip) -> dict:
    """
    Unified response template for all trip endpoints.
    ai_recommendation is always included — null if not yet generated.
    """
    return {
        "id":                       trip.id,
        "destination":              trip.destination,
        "days":                     trip.days,
        "budget":                   trip.budget,
        "currency":                 trip.currency,
        "daily_budget":             trip.daily_budget,
        "travel_style":             trip.travel_style,
        "travel_month":             trip.travel_month,
        "travel_season":            trip.travel_season,
        "category":                 trip.category,
        "recommendation_transport": trip.recommendation_transport,
        "ai_recommendation":        trip.ai_recommendation,
    }


# ─── GENERAL ──────────────────────────────────────────────────────────────────

@app.get("/", tags=["General"])
def home():
    return {"message": "Welcome to KelanaAI"}


@app.get("/health", tags=["General"])
def health():
    db_ok = check_db_connection()
    return {
        "status":   "ok" if db_ok else "degraded",
        "database": "connected" if db_ok else "unreachable",
    }


# ─── TRIPS ────────────────────────────────────────────────────────────────────

@app.post("/api/v1/trips", tags=["Trips"])
def create_trip(req: TripRequest, db: Session = Depends(get_db)):
    """Creates a trip, saves it to the database, and returns the saved record."""
    derived = compute_trip_fields(req.budget, req.days, req.travel_month)

    trip = Trip(
        destination  = req.destination,
        days         = req.days,
        budget       = req.budget,
        currency     = req.currency,
        travel_style = req.travel_style,
        travel_month = req.travel_month,
        **derived,
    )

    try:
        db.add(trip)
        db.commit()      # created_at is filled by the column's now() default
        db.refresh(trip)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save trip: {str(e)}")

    # Generate the itinerary up front; a Bedrock outage must not lose the trip
    _generate_and_save(db, trip, strict=False)

    return _trip_response(trip)


@app.get("/api/v1/trips", tags=["Trips"])
def list_trips(db: Session = Depends(get_db)):
    """Returns all saved trips from the database."""
    return [_trip_response(t) for t in db.query(Trip).all()]


@app.get("/api/v1/trips/{trip_id}", tags=["Trips"])
def get_trip(trip_id: int, db: Session = Depends(get_db)):
    """Returns a single trip by ID."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return _trip_response(trip)


@app.put("/api/v1/trips/{trip_id}", tags=["Trips"])
def update_trip(trip_id: int, req: BudgetUpdateRequest, db: Session = Depends(get_db)):
    """Updates the budget for a trip and recalculates all derived fields."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    derived = compute_trip_fields(req.budget, trip.days, trip.travel_month)
    trip.budget = req.budget
    for key, value in derived.items():
        setattr(trip, key, value)

    _db_commit(db, "Failed to update trip")
    db.refresh(trip)

    # Budget, category and daily budget all changed — the old itinerary is stale
    _generate_and_save(db, trip, strict=False)

    return _trip_response(trip)


@app.delete("/api/v1/trips/{trip_id}", tags=["Trips"])
def delete_trip(trip_id: int, db: Session = Depends(get_db)):
    """Deletes a trip by ID. Returns 404 if the ID is not found."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    try:
        db.delete(trip)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete trip: {str(e)}")

    return {"message": f"Trip {trip_id} deleted successfully"}


@app.post("/api/v1/trips/{trip_id}/generate", tags=["Trips"])
def generate_ai_recommendation(trip_id: int, db: Session = Depends(get_db)):
    """
    Generates a structured AI itinerary for an existing trip via Amazon Bedrock
    and saves it to the ai_recommendation column.
    """
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    _generate_and_save(db, trip, strict=True)
    return _trip_response(trip)


# ─── TRIP CATEGORIES ──────────────────────────────────────────────────────────

@app.get("/api/v1/trip-categories", tags=["Trip Categories"])
def list_trip_categories():
    """Returns all available trip categories and their budget ranges."""
    return TRIP_CATEGORIES


@app.post("/api/v1/trip-categories", tags=["Trip Categories"])
def get_category(req: BudgetRequest):
    """Returns the trip category for a given budget."""
    return {
        "budget":   req.budget,
        "category": get_trip_category(req.budget),
    }


# ─── TRANSPORTATIONS ──────────────────────────────────────────────────────────

@app.get("/api/v1/transportations", tags=["Transportations"])
def list_transportations() -> List[str]:
    """Returns a list of all available transport options."""
    return TRANSPORTATIONS


@app.post("/api/v1/transportations", tags=["Transportations"])
def get_transportation(req: BudgetRequest):
    """Returns the recommended transport for a given budget."""
    return {
        "budget":                   req.budget,
        "category":                 get_trip_category(req.budget),
        "recommendation_transport": get_transport_category(req.budget),
    }


# ─── RECOMMENDATIONS ──────────────────────────────────────────────────────────

@app.get("/api/v1/recommendations", tags=["Recommendations"])
def list_recommendations() -> List[str]:
    """Returns a list of recommended places to visit."""
    return RECOMMENDATIONS
