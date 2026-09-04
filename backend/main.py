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
from services.auth_service import register_user, login_user, get_current_user
from services.kb_service import ask_knowledge_base, retrieve_passages
from services.conversation_service import (
    create_conversation,
    list_conversations,
    get_conversation,
    add_message,
    list_messages,
    send_message,
)
from database import Base, engine, get_db, check_db_connection
from models.trip import Trip
import models  # noqa: F401 — registers all tables (User, Trip, Conversation, Message) with Base.metadata
from models.user import User

import logging
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified / created.")
    except Exception as e:
        # Log the full error — don't hide it
        logger.error(f"create_all failed: {e}")
    yield


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
    days:         int   = Field(gt=0)
    budget:       float = Field(gt=0)
    currency:     str   = "USD"
    travel_style: Optional[str] = None
    travel_month: Optional[str] = None

class BudgetRequest(BaseModel):
    budget: float = Field(gt=0)

class BudgetUpdateRequest(BaseModel):
    budget: float = Field(gt=0)

class RegisterRequest(BaseModel):
    name:     str
    email:    str
    password: str = Field(min_length=8)

class LoginRequest(BaseModel):
    email:    str
    password: str

class KBQuestionRequest(BaseModel):
    question:          str
    number_of_results: int = Field(default=3, ge=1, le=10)

class QuestionRequest(BaseModel):
    question: str

class ConversationCreateRequest(BaseModel):
    title:         Optional[str] = None
    first_message: Optional[str] = None   # used to auto-derive title if title omitted

class ConversationRenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)

class MessageCreateRequest(BaseModel):
    role:    str   # "user" | "assistant"
    content: str


# ─── SHARED HELPERS ───────────────────────────────────────────────────────────

def compute_trip_fields(budget: float, days: int, travel_month: Optional[str]) -> dict:
    return {
        "category":                 get_trip_category(budget),
        "recommendation_transport": get_transport_category(budget),
        "daily_budget":             round(calculate_daily_budget(budget, days), 2),
        "travel_season":            get_travel_season(travel_month) if travel_month else None,
    }


def _db_commit(db: Session, error_msg: str):
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"{error_msg}: {str(e)}")


def _call_bedrock(trip: Trip) -> str:
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
    return {
        "id":                       trip.id,
        "user_id":                  trip.user_id,
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


def _get_own_trip(trip_id: int, current_user: User, db: Session) -> Trip:
    """Fetch a trip by ID and verify it belongs to the current user."""
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return trip


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


# ─── ASK ──────────────────────────────────────────────────────────────────────

@app.post("/api/v1/ask", tags=["Ask"])
def ask_endpoint(request: QuestionRequest):
    """
    Send a question to the Bedrock Knowledge Base and return a grounded answer.

    The backend orchestrates three steps automatically:
      1. Sends the question to the Knowledge Base.
      2. Receives the grounded answer from Bedrock (RetrieveAndGenerate).
      3. Returns the answer to the caller.

    AWS credentials never leave the backend — the frontend only calls this endpoint.
    """
    try:
        answer, sources = ask_knowledge_base(request.question)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"/api/v1/ask error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"Knowledge Base error: {str(e)}")

    return {
        "question": request.question,
        "answer":   answer,
        "sources":  sources,
    }


# ─── TRIPS ────────────────────────────────────────────────────────────────────

@app.post("/api/v1/trips", tags=["Trips"])
def create_trip(
    req: TripRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates a trip owned by the authenticated user."""
    derived = compute_trip_fields(req.budget, req.days, req.travel_month)

    trip = Trip(
        user_id      = current_user.id,
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
        db.commit()
        db.refresh(trip)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save trip: {str(e)}")

    _generate_and_save(db, trip, strict=False)
    return _trip_response(trip)


@app.get("/api/v1/trips", tags=["Trips"])
def list_trips(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns only the trips that belong to the authenticated user."""
    trips = db.query(Trip).filter(Trip.user_id == current_user.id).all()
    return [_trip_response(t) for t in trips]


@app.get("/api/v1/trips/{trip_id}", tags=["Trips"])
def get_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns a single trip — only if it belongs to the authenticated user."""
    return _trip_response(_get_own_trip(trip_id, current_user, db))


@app.put("/api/v1/trips/{trip_id}", tags=["Trips"])
def update_trip(
    trip_id: int,
    req: BudgetUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Updates the budget for the user's own trip and recalculates derived fields."""
    trip = _get_own_trip(trip_id, current_user, db)

    derived = compute_trip_fields(req.budget, trip.days, trip.travel_month)
    trip.budget = req.budget
    for key, value in derived.items():
        setattr(trip, key, value)

    _db_commit(db, "Failed to update trip")
    db.refresh(trip)
    _generate_and_save(db, trip, strict=False)
    return _trip_response(trip)


@app.delete("/api/v1/trips/{trip_id}", tags=["Trips"])
def delete_trip(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deletes the user's own trip."""
    trip = _get_own_trip(trip_id, current_user, db)

    try:
        db.delete(trip)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete trip: {str(e)}")

    return {"message": f"Trip {trip_id} deleted successfully"}


@app.post("/api/v1/trips/{trip_id}/generate", tags=["Trips"])
def generate_ai_recommendation(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-generates the AI itinerary for the user's own trip."""
    trip = _get_own_trip(trip_id, current_user, db)
    _generate_and_save(db, trip, strict=True)
    return _trip_response(trip)


# ─── TRIP CATEGORIES ──────────────────────────────────────────────────────────

@app.get("/api/v1/trip-categories", tags=["Trip Categories"])
def list_trip_categories():
    return TRIP_CATEGORIES


@app.post("/api/v1/trip-categories", tags=["Trip Categories"])
def get_category(req: BudgetRequest):
    return {"budget": req.budget, "category": get_trip_category(req.budget)}


# ─── TRANSPORTATIONS ──────────────────────────────────────────────────────────

@app.get("/api/v1/transportations", tags=["Transportations"])
def list_transportations() -> List[str]:
    return TRANSPORTATIONS


@app.post("/api/v1/transportations", tags=["Transportations"])
def get_transportation(req: BudgetRequest):
    return {
        "budget":                   req.budget,
        "category":                 get_trip_category(req.budget),
        "recommendation_transport": get_transport_category(req.budget),
    }


# ─── RECOMMENDATIONS ──────────────────────────────────────────────────────────

@app.get("/api/v1/recommendations", tags=["Recommendations"])
def list_recommendations() -> List[str]:
    return RECOMMENDATIONS


# ─── KNOWLEDGE BASE ───────────────────────────────────────────────────────────

@app.post("/api/v1/kb/ask", tags=["Knowledge Base"])
def kb_ask(
    req: KBQuestionRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Ask a question against the Bedrock Knowledge Base.

    Bedrock retrieves relevant document passages and generates a grounded
    answer in a single API call (RetrieveAndGenerate / RAG).
    """
    try:
        answer = ask_knowledge_base(
            question=req.question,
            number_of_results=req.number_of_results,
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"KB ask error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"Knowledge Base error: {str(e)}")

    return {"question": req.question, "answer": answer}


@app.post("/api/v1/kb/retrieve", tags=["Knowledge Base"])
def kb_retrieve(
    req: KBQuestionRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve raw document passages from the Knowledge Base without generation.

    Returns the top matching chunks with their relevance scores and source URIs,
    useful for debugging retrieval quality or building custom prompts.
    """
    try:
        passages = retrieve_passages(
            question=req.question,
            number_of_results=req.number_of_results,
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"KB retrieve error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"Knowledge Base error: {str(e)}")

    return {"question": req.question, "passages": passages}


# ─── AUTH ─────────────────────────────────────────────────────────────────────

@app.post("/api/v1/auth/register", status_code=201, tags=["Auth"])
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """Creates a new user account with a bcrypt-hashed password."""
    user = register_user(req.name, req.email, req.password, db)
    return {"id": user.id, "name": user.name, "email": user.email}


@app.post("/api/v1/auth/login", tags=["Auth"])
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Verifies credentials and returns a signed JWT."""
    return login_user(req.email, req.password, db)


@app.get("/api/v1/auth/me", tags=["Auth"])
def me(current_user: User = Depends(get_current_user)):
    """Returns the profile of the currently authenticated user."""
    return {
        "id":    current_user.id,
        "name":  current_user.name,
        "email": current_user.email,
    }


# ─── CONVERSATIONS ────────────────────────────────────────────────────────────

def _conversation_response(conv) -> dict:
    return {
        "id":         conv.id,
        "user_id":    conv.user_id,
        "title":      conv.title,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
    }


def _message_response(msg) -> dict:
    return {
        "id":              msg.id,
        "conversation_id": msg.conversation_id,
        "role":            msg.role,
        "content":         msg.content,
        "created_at":      msg.created_at.isoformat() if msg.created_at else None,
    }


@app.post("/api/v1/conversations", status_code=201, tags=["Conversations"])
def create_conversation_endpoint(
    req: ConversationCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new conversation row for the authenticated user.

    Optionally pass `title` directly, or `first_message` to have the title
    auto-derived from the first 60 characters of that message.
    Returns the new conversation's identifier.
    """
    try:
        conv = create_conversation(
            user_id=current_user.id,
            db=db,
            title=req.title,
            first_message=req.first_message,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create conversation: {str(e)}")

    return {"conversation_id": conv.id}


@app.get("/api/v1/conversations", tags=["Conversations"])
def list_conversations_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all previous conversations for the authenticated user, newest first.
    Returns id, title, and created_at for each conversation.
    """
    convs = list_conversations(user_id=current_user.id, db=db)
    return [_conversation_response(c) for c in convs]


@app.get("/api/v1/conversations/{conversation_id}", tags=["Conversations"])
def get_conversation_endpoint(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a single conversation with its full message history."""
    conv = get_conversation(conversation_id, current_user.id, db)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {
        **_conversation_response(conv),
        "messages": [_message_response(m) for m in conv.messages],
    }


@app.patch("/api/v1/conversations/{conversation_id}", tags=["Conversations"])
def rename_conversation_endpoint(
    conversation_id: int,
    req: ConversationRenameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rename a conversation title. Only the owner may rename it."""
    conv = get_conversation(conversation_id, current_user.id, db)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    try:
        conv.title = req.title.strip()
        db.commit()
        db.refresh(conv)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to rename conversation: {str(e)}")
    return _conversation_response(conv)


@app.post("/api/v1/conversations/{conversation_id}/messages", status_code=201, tags=["Conversations"])
def send_message_endpoint(
    conversation_id: int,
    req: MessageCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Send a user message and receive an AI reply — full 7-step orchestration.

    Steps (all handled server-side):
      01  Receive user message
      02  Save user message to DB
      03  Load previous messages (conversation history)
      04  Build Bedrock Converse prompt from history
      05  Call Amazon Bedrock (Nova Lite via Converse API)
      06  Save AI response to DB
      07  Return both messages to the caller

    Request body: { "role": "user", "content": "<message text>" }
    The `role` field must be "user" — only users initiate turns via this endpoint.

    Returns:
      {
        "user_message":      { id, conversation_id, role, content, created_at },
        "assistant_message": { id, conversation_id, role, content, created_at }
      }
    """
    if req.role != "user":
        raise HTTPException(
            status_code=422,
            detail="role must be 'user' — assistant replies are generated automatically.",
        )

    try:
        result = send_message(
            conversation_id=conversation_id,
            user_id=current_user.id,
            user_content=req.content,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"send_message error conv={conversation_id}: {type(e).__name__}: {e}")
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

    return result


@app.get("/api/v1/conversations/{conversation_id}/messages", tags=["Conversations"])
def list_messages_endpoint(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all messages in a conversation in chronological order."""
    conv = get_conversation(conversation_id, current_user.id, db)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msgs = list_messages(conversation_id=conversation_id, db=db)
    return [_message_response(m) for m in msgs]
