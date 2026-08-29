import bcrypt
from jose import jwt

SECRET_KEY = “your-secret-key”

def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        bytes(password, encoding="utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")

def register(name, email, password):
    # NEVER store plain text – hash the password
    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password)
    )
    db.add(user)
    db.commit()
    return user


def login(email, password):
    user = db.query(User).filter(
    User.email == email
    ).first()

# Verify password against stored hash
    if not pwd_context.verify(
        password, user.password_hash
    ):
        raise HTTPException(401)
# Generate JWT
    token = jwt.encode(
        { sub”: user.id, “exp”: …}, SECRET_KEY
    )
    return {“access_token”: token}