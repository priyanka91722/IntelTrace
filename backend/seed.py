"""Seed demo users: admin / investigator / viewer (all password Demo@123 except admin)."""
from app.database import Base, engine, SessionLocal
from app import models
from app.auth import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()
demo = [("admin", "Default Admin", "admin", "Admin@123"),
        ("alicia", "Alicia Fernandes", "investigator", "Demo@123"),
        ("joanna", "Joanna Dsouza", "investigator", "Demo@123"),
        ("viewer", "Panel Viewer", "viewer", "Demo@123")]
for username, full_name, role, pw in demo:
    if not db.query(models.User).filter_by(username=username).first():
        db.add(models.User(username=username, full_name=full_name, role=role,
                           password_hash=hash_password(pw)))
        print(f"created {role}: {username} / {pw}")
db.commit()
db.close()
