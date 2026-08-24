import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

# Load .env so os.getenv() can read it
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in .env")

IS_POOLER = "pooler.supabase.com" in DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    # Pooler handles SSL internally — only force sslmode on direct connections
    connect_args={} if IS_POOLER else {"sslmode": "require"},
)

# Factory for DB sessions
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

# All ORM models inherit from this
Base = declarative_base()


# ─── DEPENDENCY ───────────────────────────────────────────────────────────────
# Use this in FastAPI route parameters: db: Session = Depends(get_db)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
def check_db_connection() -> bool:
    """Returns True if the database is reachable, False otherwise."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
