from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import (hash_password, verify_password, create_access_token,
                    get_current_user, require_role)
from ..services import login_guard

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=schemas.Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    wait = login_guard.seconds_until_unlocked(form.username)
    if wait > 0:
        raise HTTPException(status_code=429,
                            detail=f"Too many failed attempts. Try again in {int(wait) // 60 + 1} minute(s).")
    user = db.query(models.User).filter_by(username=form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        login_guard.record_failure(form.username)
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    login_guard.record_success(form.username)
    return schemas.Token(access_token=create_access_token(user), role=user.role,
                         username=user.username, full_name=user.full_name)


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user


@router.get("/users", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db), _: models.User = Depends(require_role("admin"))):
    return db.query(models.User).order_by(models.User.id).all()


@router.post("/users", response_model=schemas.UserOut)
def create_user(body: schemas.UserCreate, db: Session = Depends(get_db),
                _: models.User = Depends(require_role("admin"))):
    if body.role not in ("admin", "investigator", "viewer"):
        raise HTTPException(status_code=400, detail="Role must be admin, investigator or viewer")
    if db.query(models.User).filter_by(username=body.username).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    user = models.User(username=body.username, full_name=body.full_name,
                       role=body.role, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db),
                admin: models.User = Depends(require_role("admin"))):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"deleted": user_id}


@router.post("/users/{user_id}/password")
def change_user_password(user_id: int, body: schemas.PasswordChange, db: Session = Depends(get_db),
                        admin: models.User = Depends(require_role("admin"))):
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True, "username": user.username}
