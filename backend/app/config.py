import os
import secrets
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
REPO_ROOT = BASE_DIR.parent

load_dotenv(REPO_ROOT / ".env")  # real environment variables always take priority

_env_secret = os.getenv("INTELTRACE_SECRET_KEY")
if _env_secret:
    SECRET_KEY = _env_secret
else:
    # No persistent secret configured — generate a random one for this process
    # rather than falling back to a fixed, publicly-known string (that would let
    # anyone forge a valid admin JWT). Every existing token is invalidated on
    # restart; set INTELTRACE_SECRET_KEY for a real deployment.
    SECRET_KEY = secrets.token_hex(32)
    print(">> WARNING: INTELTRACE_SECRET_KEY not set — using a random, ephemeral "
          "JWT signing key for this process. All sessions will be invalidated on "
          "restart. Set INTELTRACE_SECRET_KEY in your environment for production.")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("INTELTRACE_TOKEN_MINUTES", "480"))

# SQLite by default; switch to MySQL by setting INTELTRACE_DB_URL
# e.g. mysql+pymysql://user:password@localhost:3306/inteltrace
DATABASE_URL = os.getenv("INTELTRACE_DB_URL", f"sqlite:///{BASE_DIR / 'inteltrace.db'}")

EVIDENCE_STORE = Path(os.getenv("INTELTRACE_EVIDENCE_STORE", BASE_DIR / "evidence_store"))
REPORTS_DIR = Path(os.getenv("INTELTRACE_REPORTS_DIR", BASE_DIR / "reports"))
EVIDENCE_STORE.mkdir(parents=True, exist_ok=True)
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

# Business rules
WORKING_HOURS = (6, 18)          # 06:00 - 18:00 local = working hours
RELATED_EVENT_WINDOW_MIN = 10    # timeline "related sequence" grouping window
# Evidence (esp. bulk log/dataset exports) regularly exceeds a few hundred MB —
# 200 was too tight for real uploads. Streamed to disk in 1MB chunks either
# way (see routers/evidence.py::upload_evidence), so raising this doesn't
# change memory usage, only how big a file the server will accept.
MAX_UPLOAD_MB = int(os.getenv("INTELTRACE_MAX_UPLOAD_MB", "2048"))

# Explicit override if the tesseract binary is installed but not on PATH
# (common on Windows). See services/ocr_chat.py for the auto-detect fallback.
TESSERACT_CMD = os.getenv("INTELTRACE_TESSERACT_CMD", "")

# Optional fixed password for the auto-created default admin (see main.py::ensure_admin).
# Leave unset for real deployments — a random one-time password is generated and
# printed instead. Useful for CI/tests that need a deterministic login.
ADMIN_BOOTSTRAP_PASSWORD = os.getenv("INTELTRACE_ADMIN_PASSWORD")

# Comma-separated list of frontend origins allowed to call this API. Defaults
# to the local Vite dev server only — set INTELTRACE_CORS_ORIGINS for a real
# deployment's actual frontend origin(s). Never default to "*": the JWT is
# sent from client JS, so an unrestricted origin lets any website script
# requests against this API in a logged-in user's browser.
CORS_ORIGINS = [o.strip() for o in os.getenv(
    "INTELTRACE_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if o.strip()]
