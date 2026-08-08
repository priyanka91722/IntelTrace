from datetime import datetime, timedelta, timezone
import jwt
from passlib.hash import pbkdf2_sha256
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from . import models
from .database import get_db
from .config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

ROLE_RANK = {"viewer": 1, "investigator": 2, "admin": 3}


def hash_password(pw: str) -> str:
    return pbkdf2_sha256.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return pbkdf2_sha256.verify(pw, hashed)
    except Exception:
        return False


def create_access_token(user: models.User) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user.id), "username": user.username, "role": user.role, "exp": exp}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    cred_exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                             detail="Invalid or expired token",
                             headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except Exception:
        raise cred_exc
    user = db.get(models.User, user_id)
    if not user:
        raise cred_exc
    return user


def require_role(minimum: str):
    def dep(user: models.User = Depends(get_current_user)) -> models.User:
        if ROLE_RANK.get(user.role, 0) < ROLE_RANK[minimum]:
            raise HTTPException(status_code=403, detail=f"Requires {minimum} role or higher")
        return user
    return dep
