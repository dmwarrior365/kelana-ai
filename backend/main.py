from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Optional, List
from services.trip_service import (
    get_trip_category,
    get_travel_season,
    get_transport_category,
    calculate_daily_budget,
)

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


# ─── GENERAL ──────────────────────────────────────────────────────────────────

@app.get("/", tags=["General"])
def home():
    return {"message": "Welcome to KelanaAI"}

@app.get("/health", tags=["General"])
def health():
    return {"status": "ok"}


# ─── TRIPS ────────────────────────────────────────────────────────────────────

@app.post("/api/v1/trips", tags=["Trips"])
def create_trip(trip: TripRequest):
    """Returns a full trip summary including category, transport, daily budget, and season."""
    return {
        "destination":              trip.destination,
        "days":                     trip.days,
        "budget":                   trip.budget,
        "currency":                 trip.currency,
        "daily_budget":             round(calculate_daily_budget(trip.budget, trip.days), 2),
        "travel_style":             trip.travel_style,
        "travel_month":             trip.travel_month,
        "travel_season":            get_travel_season(trip.travel_month) if trip.travel_month else None,
        "category":                 get_trip_category(trip.budget),
        "recommendation_transport": get_transport_category(trip.budget),
    }


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
def get_recommendations(trip: TripRequest):
    """Returns personalised travel recommendations based on trip details."""
    category      = get_trip_category(trip.budget)
    transport     = get_transport_category(trip.budget)
    daily_budget  = calculate_daily_budget(trip.budget, trip.days)
    travel_season = get_travel_season(trip.travel_month) if trip.travel_month else None

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
        "destination":              trip.destination,
        "days":                     trip.days,
        "budget":                   trip.budget,
        "currency":                 trip.currency,
        "daily_budget":             round(daily_budget, 2),
        "travel_style":             trip.travel_style,
        "travel_month":             trip.travel_month,
        "travel_season":            travel_season,
        "category":                 category,
        "recommendation_transport": transport,
        "tips":                     tips,
    }
