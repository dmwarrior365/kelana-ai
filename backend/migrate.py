"""
One-shot migration: bring conversations and messages tables in line with
the SQLAlchemy ORM models.

Uses ADD COLUMN IF NOT EXISTS so it is safe to run multiple times.

Run from the backend directory:
    python migrate.py
"""

from dotenv import load_dotenv
load_dotenv()

from database import engine
from sqlalchemy import text

MIGRATIONS = [
    # ── conversations ─────────────────────────────────────────────────────────
    # Create the table if it somehow doesn't exist yet
    """
    CREATE TABLE IF NOT EXISTS conversations (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title      VARCHAR,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    # Add missing columns to an existing table (all idempotent)
    "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS title      VARCHAR",
    "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()",
    "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()",
    "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE",

    # Index on user_id for fast per-user queries
    "CREATE INDEX IF NOT EXISTS ix_conversations_user_id ON conversations (user_id)",
    "CREATE INDEX IF NOT EXISTS ix_conversations_id      ON conversations (id)",

    # ── chat_messages (renamed from messages to avoid collision with ──────────
    # ── Supabase's internal realtime messages table) ───────────────────────────
    """
    CREATE TABLE IF NOT EXISTS chat_messages (
        id              SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role            VARCHAR NOT NULL,
        content         TEXT    NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    )
    """,
    "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE",
    "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS role            VARCHAR",
    "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS content         TEXT",
    "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ NOT NULL DEFAULT now()",

    "CREATE INDEX IF NOT EXISTS ix_chat_messages_conversation_id ON chat_messages (conversation_id)",
    "CREATE INDEX IF NOT EXISTS ix_chat_messages_id              ON chat_messages (id)",

    # ── Clean up columns accidentally added to Supabase's internal messages ───
    "ALTER TABLE messages DROP COLUMN IF EXISTS conversation_id",
    "ALTER TABLE messages DROP COLUMN IF EXISTS role",
    "ALTER TABLE messages DROP COLUMN IF EXISTS content",
]


def run():
    with engine.begin() as conn:
        for sql in MIGRATIONS:
            stmt = sql.strip()
            if not stmt:
                continue
            try:
                conn.execute(text(stmt))
                # Print just the first line as a short label
                print(f"  OK  {stmt.splitlines()[0][:80]}")
            except Exception as e:
                # Some ALTER TABLE errors are non-fatal (e.g. NOT NULL on existing rows);
                # print and continue so we still run every statement.
                print(f"  WARN  {stmt.splitlines()[0][:80]}")
                print(f"        {e}")

    print("\nMigration complete.")


if __name__ == "__main__":
    run()
