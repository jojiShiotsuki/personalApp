import os
import logging
from datetime import datetime, timedelta
from typing import Optional

import hashlib

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User

# Configuration
logger = logging.getLogger(__name__)
_is_production = os.getenv("RENDER") or os.getenv("ENVIRONMENT") == "production"
SECRET_KEY = os.getenv("SECRET_KEY", "" if _is_production else "dev-secret-key-change-in-production")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable must be set in production")
if not _is_production and not os.getenv("SECRET_KEY"):
    logger.warning("Using default SECRET_KEY for development. Set SECRET_KEY env var for production.")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# Bearer token extraction
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    # Pre-hash with sha256 to handle bcrypt's 72-byte limit
    pw_bytes = hashlib.sha256(password.encode()).hexdigest().encode()
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    pw_bytes = hashlib.sha256(plain_password.encode()).hexdigest().encode()
    return bcrypt.checkpw(pw_bytes, hashed_password.encode())


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
