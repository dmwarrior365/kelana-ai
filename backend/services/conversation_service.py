from __future__ import annotations

from typing import Optional
from sqlalchemy.orm import Session

from models.conversation import Conversation
from models.message import Message


# ─── HELPERS ──────────────────────────────────────────────────────────────────

def _derive_title(first_message: Optional[str]) -> Optional[str]:
    """Truncate the first user message to 60 chars as a conversation title."""
    if not first_message:
        return None
    cleaned = first_message.strip()
    return cleaned[:60] + ("…" if len(cleaned) > 60 else "")


# ─── CREATE ───────────────────────────────────────────────────────────────────

def create_conversation(
    user_id: int,
    db: Session,
    title: Optional[str] = None,
    first_message: Optional[str] = None,
) -> Conversation:
    """
    Insert a new conversation row for the given user.

    If `title` is not provided, it is derived automatically from `first_message`.
    Returns the freshly created and refreshed Conversation ORM object.
    """
    resolved_title = title or _derive_title(first_message)

    conversation = Conversation(user_id=user_id, title=resolved_title)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


# ─── LIST ─────────────────────────────────────────────────────────────────────

def list_conversations(user_id: int, db: Session) -> list[Conversation]:
    """
    Return all conversations belonging to the user, newest first.
    """
    return (
        db.query(Conversation)
        .filter(Conversation.user_id == user_id)
        .order_by(Conversation.created_at.desc())
        .all()
    )


# ─── GET SINGLE ───────────────────────────────────────────────────────────────

def get_conversation(conversation_id: int, user_id: int, db: Session) -> Conversation | None:
    """
    Return a single conversation only if it belongs to the user.
    Returns None when not found or ownership check fails.
    """
    return (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id,
        )
        .first()
    )


# ─── MESSAGES ─────────────────────────────────────────────────────────────────

def add_message(
    conversation_id: int,
    role: str,
    content: str,
    db: Session,
) -> Message:
    """
    Append a message to an existing conversation.
    `role` should be "user" or "assistant".
    """
    message = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def list_messages(conversation_id: int, db: Session) -> list[Message]:
    """Return all messages for a conversation, ordered chronologically."""
    return (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )


# ─── SEND MESSAGE ORCHESTRATION (7-step pipeline) ────────────────────────────
# Imported here (not at module top) to avoid a circular import — bedrock_service
# does not depend on conversation_service, so the one-way import is safe.
from services.bedrock_service import chat_converse

# Maximum number of message *turns* (one user + one assistant = 1 turn) to send
# to Bedrock. Older messages beyond this window are dropped to keep token costs
# bounded (~8K tokens for a long history). Must be ≥ 1.
MAX_CONTEXT_TURNS: int = 20  # keeps the last 40 messages (20 user + 20 assistant)


def _trim_context(messages: list[Message], max_turns: int = MAX_CONTEXT_TURNS) -> list[Message]:
    """
    Return at most `max_turns` complete conversation turns from the end of history.

    A "turn" is one user message paired with the assistant reply that follows it.
    We keep the last `max_turns * 2` messages so the window always ends on an
    assistant reply and starts on a user turn, which satisfies the Bedrock
    strictly-alternating requirement without extra processing.

    If the history is shorter than the window it is returned unchanged.
    """
    max_msgs = max_turns * 2
    if len(messages) <= max_msgs:
        return messages
    trimmed = messages[-max_msgs:]
    # Ensure the first message after trimming is a user turn
    while trimmed and trimmed[0].role != "user":
        trimmed = trimmed[1:]
    return trimmed


def send_message(
    conversation_id: int,
    user_id: int,
    user_content: str,
    db: Session,
) -> dict:
    """
    Full orchestration for POST /api/v1/conversations/{id}/messages.

    Step 01 — Receive user message  (validated by the caller / FastAPI schema)
    Step 02 — Save user message to DB
    Step 03 — Load previous messages to build conversation history
    Step 04 — Build Bedrock Converse message list (prompt)
    Step 05 — Call Amazon Bedrock (chat_converse)
    Step 06 — Save AI response to DB
    Step 07 — Return both messages to the caller

    Args:
        conversation_id: The conversation this message belongs to.
        user_id:         Owner of the conversation (used for ownership check).
        user_content:    The raw text from the user.
        db:              Active SQLAlchemy session.

    Returns:
        dict with keys:
          - user_message:      the saved user Message object serialised to dict
          - assistant_message: the saved assistant Message object serialised to dict

    Raises:
        ValueError:  If the conversation does not exist or belongs to another user.
        Exception:   Propagated from Bedrock on API errors.
    """
    # ── Step 01: Receive (content already in user_content arg) ────────────────
    # Ownership guard — raises ValueError so the route can map it to 404/403
    conv = get_conversation(conversation_id, user_id, db)
    if conv is None:
        raise ValueError(f"Conversation {conversation_id} not found or access denied.")

    # ── Step 02: Save user message ────────────────────────────────────────────
    user_msg = add_message(
        conversation_id=conversation_id,
        role="user",
        content=user_content,
        db=db,
    )

    # Auto-set title from first user message when the conversation has no title yet
    if not conv.title:
        conv.title = user_content.strip()[:60] + ("…" if len(user_content.strip()) > 60 else "")
        db.commit()
        db.refresh(conv)

    # ── Step 03: Load previous messages (full history including the one just saved) ──
    history = list_messages(conversation_id=conversation_id, db=db)

    # ── Step 04: Build Bedrock Converse message list ──────────────────────────
    # Trim to the last MAX_CONTEXT_TURNS turns to cap token usage (Part 8:
    # "Recent Messages" strategy — send only the last N turns, cheaper and
    # usually enough context). Full history is still stored in the DB.
    windowed = _trim_context(history)

    # Bedrock requires strictly alternating user/assistant turns.
    # We replay the windowed history; any leading assistant turns are skipped
    # and consecutive same-role turns are merged as a safety net.
    converse_messages: list[dict] = []
    for msg in windowed:
        role = msg.role  # "user" | "assistant"
        # Skip any leading assistant turns (Bedrock rejects conversations that
        # don't start with a user turn)
        if not converse_messages and role != "user":
            continue
        # Merge consecutive same-role turns into one (safety net)
        if converse_messages and converse_messages[-1]["role"] == role:
            converse_messages[-1]["content"][0]["text"] += "\n" + msg.content
        else:
            converse_messages.append(
                {"role": role, "content": [{"text": msg.content}]}
            )

    # ── Step 05: Call Amazon Bedrock ──────────────────────────────────────────
    assistant_text = chat_converse(messages=converse_messages)

    # ── Step 06: Save AI response ─────────────────────────────────────────────
    assistant_msg = add_message(
        conversation_id=conversation_id,
        role="assistant",
        content=assistant_text,
        db=db,
    )

    # ── Step 07: Return response ──────────────────────────────────────────────
    def _serialise(m: Message) -> dict:
        return {
            "id":              m.id,
            "conversation_id": m.conversation_id,
            "role":            m.role,
            "content":         m.content,
            "created_at":      m.created_at.isoformat() if m.created_at else None,
        }

    return {
        "user_message":      _serialise(user_msg),
        "assistant_message": _serialise(assistant_msg),
    }
