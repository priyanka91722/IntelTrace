import secrets
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine, SessionLocal
from . import models
from .auth import hash_password
from .config import ADMIN_BOOTSTRAP_PASSWORD, CORS_ORIGINS
from .routers import auth_r, cases, evidence, analysis, reports

Base.metadata.create_all(bind=engine)

app = FastAPI(title="IntelTrace", version="0.1.0",
              description="AI-powered cybercrime evidence investigation & digital "
                          "forensic triage platform")

app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"],
                   allow_headers=["*"], allow_credentials=False)

for r in (auth_r.router, cases.router, evidence.router, analysis.router, reports.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "IntelTrace"}


@app.on_event("startup")
def ensure_admin():
    """First run: create a default admin so the app is usable immediately.
    The password is random and shown only once here unless
    INTELTRACE_ADMIN_PASSWORD is set — a fixed default here would mean any
    fresh deployment starts with a publicly-known admin login."""
    db = SessionLocal()
    try:
        if not db.query(models.User).first():
            password = ADMIN_BOOTSTRAP_PASSWORD or secrets.token_urlsafe(12)
            db.add(models.User(username="admin", full_name="Default Admin",
                               role="admin", password_hash=hash_password(password)))
            db.commit()
            if ADMIN_BOOTSTRAP_PASSWORD:
                print(">> Created default admin (admin) using INTELTRACE_ADMIN_PASSWORD.")
            else:
                print(f">> Created default admin — username: admin  password: {password}")
                print(">> This password is shown ONLY here. Save it now and change it after logging in.")
    finally:
        db.close()
