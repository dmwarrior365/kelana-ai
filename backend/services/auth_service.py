import os
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import get_db
from models.user import User

# ─── PASSWORD HASHING ─────────────────────────────────────────────────────────
# passlib wraps bcrypt: one-way, salted, slow by design
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ─── JWT ──────────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
ALGORITHM  = "HS256"
TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours


def _create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


# ─── REGISTER ─────────────────────────────────────────────────────────────────

def register_user(name: str, email: str, password: str, db: Session) -> User:
    """
    Creates a new user. Raises 409 if the email is already taken.
    Stores only the bcrypt hash — never the plain-text password.
    """
    try:
        existing = db.query(User).filter(User.email == email).first()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during registration: {type(e).__name__}: {e}",
        )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with that email already exists.",
        )

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
    )
    try:
        db.add(user)
        db.commit()
        db.refresh(user)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {type(e).__name__}: {e}",
        )
    return user


# ─── LOGIN ────────────────────────────────────────────────────────────────────

def login_user(email: str, password: str, db: Session) -> dict:
    """
    Verifies credentials and returns a signed JWT.
    Returns a generic 401 for both 'user not found' and 'wrong password'
    so attackers cannot enumerate existing accounts.
    """
    user = db.query(User).filter(User.email == email).first()

    # Constant-time path: always run verify even on a dummy hash to prevent
    # timing-based user enumeration
    _DUMMY_HASH = "$2b$12$V..gcU4sNVqQui/bh6xTxereIXIbBxwqL1eTMKb0j9lW.ESWqG1XO"
    stored_hash = user.password_hash if user else _DUMMY_HASH

    if not user or not verify_password(password, stored_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = _create_access_token(user.id)
    return {"access_token": token, "token_type": "Bearer"}


# ─── CURRENT USER DEPENDENCY ──────────────────────────────────────────────────

_bearer = HTTPBearer(auto_error=True)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """
    FastAPI dependency — decodes the Bearer JWT and returns the matching User.
    Raises 401 for any token problem (missing, expired, tampered, unknown user).
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str | None = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.get(User, int(user_id_str))
    if user is None:
        raise credentials_exception
    return user
