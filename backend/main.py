from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session

from services.trip_service import (
    get_trip_category,
    get_travel_season,
    get_transport_category,
    calculate_daily_budget,
)
from database import Base, engine, get_db, check_db_connection
from models.trip import Trip

# Create all tables on startup if they don't exist yet
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="KelanaAI",
    description="AI-powered travel planning API",
    version="1.0.0",
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
    destination: str
    days: int = Field(gt=0, description="Number of travel days")
    budget: float = Field(gt=0, description="Total trip budget")
    currency: str = "USD"
    travel_style: Optional[str] = None
    travel_month: Optional[str] = None

class BudgetRequest(BaseModel):
    budget: float = Field(gt=0)

class BudgetUpdateRequest(BaseModel):
    budget: float = Field(gt=0, description="New budget to update and recalculate from")


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

    # Compute derived fields
    category      = get_trip_category(req.budget)
    transport     = get_transport_category(req.budget)
    daily_budget  = round(calculate_daily_budget(req.budget, req.days), 2)
    travel_season = get_travel_season(req.travel_month) if req.travel_month else None

    # Build ORM object
    trip = Trip(
        destination             = req.destination,
        days                    = req.days,
        budget                  = req.budget,
        currency                = req.currency,
        travel_style            = req.travel_style,
        travel_month            = req.travel_month,
        travel_season           = travel_season,
        category                = category,
        recommendation_transport= transport,
        daily_budget            = daily_budget,
    )

    # Open → save → commit → refresh → close (handled by get_db)
    try:
        db.add(trip)
        db.commit()
        db.refresh(trip)   # pulls the generated id and any DB defaults back
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save trip: {str(e)}")

    return trip

@app.get("/api/v1/trips", tags=["Trips"])
def list_trips(db: Session = Depends(get_db)):
    """Returns all saved trips from the database."""
    trips = db.query(Trip).all()
    db.close()
    return trips

@app.get("/api/v1/trips/{trip_id}", tags=["Trips"])
def get_trip(trip_id: int, db: Session = Depends(get_db)):
    """Returns a single trip by ID."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    db.close()
    return trip


@app.put("/api/v1/trips/{trip_id}", tags=["Trips"])
def update_trip(trip_id: int, req: BudgetUpdateRequest, db: Session = Depends(get_db)):
    """Updates the budget for a trip and recalculates category and daily_budget."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    # Only budget changes — recalculate dependent fields
    trip.budget       = req.budget
    trip.category     = get_trip_category(req.budget)
    trip.daily_budget = round(calculate_daily_budget(req.budget, trip.days), 2)
    trip.recommendation_transport = get_transport_category(req.budget)

    try:
        db.commit()
        db.refresh(trip)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update trip: {str(e)}")

    return trip

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

@app.post("/api/v1/recommendations", tags=["Recommendations"])
def get_recommendations(req: TripRequest):
    """Returns personalised travel recommendations based on trip details."""
    category      = get_trip_category(req.budget)
    transport     = get_transport_category(req.budget)
    daily_budget  = calculate_daily_budget(req.budget, req.days)
    travel_season = get_travel_season(req.travel_month) if req.travel_month else None

    if category == "Backpacker":
        tips = [
            "Stay in hostels or guesthouses",
            "Use public transport and local buses",
            "Eat at street food stalls",
            "Book flights early for the best deals",
        ]
    elif category == "Standard":
        tips = [
            "Book 3-star hotels or Airbnb",
            "Mix of economy flights and local transport",
            "Balance between local restaurants and cafes",
            "Consider travel insurance",
        ]
    else:
        tips = [
            "Stay in 4 or 5-star hotels or resorts",
            "Business class flights or private transfers",
            "Fine dining and curated experiences",
            "Hire a local guide for personalised tours",
        ]

    return {
        "destination":              req.destination,
        "days":                     req.days,
        "budget":                   req.budget,
        "currency":                 req.currency,
        "daily_budget":             round(daily_budget, 2),
        "travel_style":             req.travel_style,
        "travel_month":             req.travel_month,
        "travel_season":            travel_season,
        "category":                 category,
        "recommendation_transport": transport,
        "tips":                     tips,
    }
