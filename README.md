# IntelTrace — AI-Powered Cybercrime Evidence Investigation & Digital Forensic Triage

Final-year BE Computer Engineering project, St. Francis Institute of Technology.
Group: Priyanka Chavan · Joanna Dsouza · Alicia Fernandes · Amelia Fernandes

IntelTrace is a **triage assistant** for digital investigators. It ingests evidence
(system logs, chat screenshots, financial CSVs, images/video), preserves integrity
with SHA-256 hashing and a full chain of custody, runs AI/ML analysis modules, and
produces a consolidated PDF forensic report with a cross-evidence timeline.

> **Honest scope (say this to the panel before they ask):** IntelTrace is a triage
> tool, not a court-admissible forensic suite. Reports are not Section 65B
> certified, the anomaly models are trained on synthetic/CERT-style data, and no
> device extraction is performed — files are uploaded, not imaged.

---

## Architecture

```
React (Vite) SPA ── /api proxy ──> FastAPI ──> SQLAlchemy ──> SQLite (default)
                                     │                        or MySQL via env
                                     ├─ evidence_store/   (hashed original files)
                                     └─ reports/          (generated PDFs)
```

**The key design decision: a cross-OS log ingestion layer.**
Analysis modules never touch raw OS logs. `backend/app/services/parsers.py`
auto-detects the format and normalizes everything into one internal schema:

```
{timestamp, user, event_type, device_id, filename, source_os}
```

Supported inputs → normalized events:

| Input format                         | Detection                    | source_os |
|--------------------------------------|------------------------------|-----------|
| Windows Event Viewer CSV export      | header + Event ID column     | windows   |
| Windows `.evtx` (optional python-evtx)| file magic                  | windows   |
| Linux `auth.log` / syslog            | syslog line regex            | linux     |
| CERT insider-threat style CSV        | activity column values       | mixed     |
| Generic pre-normalized CSV           | column names                 | as given  |

Event IDs are mapped (4624→logon, 4634/4647→logoff, 4663→file_access,
4660→file_delete, 6416→usb_connect, …), so the Isolation Forest sees the same
feature space regardless of OS. Adding macOS support = writing one more parser.

## Analysis modules

| Module | Technique | Output |
|--------|-----------|--------|
| Log anomaly | Isolation Forest on per-(user, day) features: non-working-hour events (6PM–6AM), logons, USB events, file access/delete/transfer | 0–100 risk score; High ≥70, Medium ≥40 |
| Chat screenshot | Tesseract OCR + ~14 keyword rule groups (threats, OTP fraud, UPI channels, KYC phishing, concealment, Hinglish) | flagged phrases with risk |
| Financial CSV | Rules (duplicates, round amounts, late-night, rapid succession) + Isolation Forest on [amount, hour, gap] | flagged transactions |
| Media verification | ELA residual (images), face/background blur inconsistency + frame jitter (video) — **heuristic**, with a documented plug-in point for a pretrained FaceForensics++ model | likely_authentic / suspicious / likely_manipulated |
| Cross-case links | Regex entity extraction (Indian phone, email, IP, UPI handle, account no.) matched across cases | linked case pairs |
| Timeline | Chronological merge of all flagged findings; events within 10 min grouped as a "linked sequence" | evidence-chain view |

## Integrity & custody

- SHA-256 computed in 4096-byte chunks at upload, re-verified immediately, and
  re-verifiable any time (`Re-verify` button / before every report).
- Any mismatch flips status to **Tampered** and is logged.
- Every action (login, upload, analysis, report, verification) writes a
  chain-of-custody row shown in the UI and appended to the PDF.

## Roles

| Role | Can |
|------|-----|
| admin | everything + user management |
| investigator | create cases, upload evidence, run analysis, generate reports |
| viewer | read-only |

---

## Running locally

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
# OCR needs the Tesseract binary:
#   Ubuntu/Debian: sudo apt install tesseract-ocr
#   Windows: https://github.com/UB-Mannheim/tesseract/wiki (add to PATH)
uvicorn app.main:app --reload            # http://localhost:8000  (docs at /docs)
```

First startup creates `admin / Admin@123` — **change it immediately** via the
Users page. Optional demo users: `python3 seed.py`
(priyanka, joanna = investigators, viewer — all `Demo@123`).

MySQL instead of SQLite:

```bash
pip install pymysql
export INTELTRACE_DB_URL="mysql+pymysql://user:pass@localhost/inteltrace"
```

Set a real secret in production: `export INTELTRACE_SECRET_KEY=$(openssl rand -hex 32)`

### Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173  (proxies /api to :8000)
```

### Verify everything

```bash
cd backend && python3 smoke_test.py      # 29 end-to-end checks
```

---

## Demo flow for the panel (uses `backend/sample_data/`)

1. Log in as `priyanka / Demo@123`, open a case "Insider data theft — Br. 7".
2. Upload `windows_security_events.csv` (type: log) → watch it auto-detect
   `windows_event_csv`, hash, and verify.
3. Upload `linux_auth.log` and `cert_style_activity.csv` → same case, three OSes,
   one normalized event table. **This is the cross-OS talking point.**
4. Upload `transactions.csv` (financial) and `chat_screenshot.png` (chat).
5. Click **Run all analysis modules** → flagged events appear with risk scores
   (BSS0369's 2AM USB + `PAYROLL_DB_EXPORT.csv` exfiltration should top the list).
6. Open **Timeline** → the late-night sequence shows as linked nodes.
7. Create a second case, upload the chat screenshot again → **Cross-case links**
   shows the shared UPI handle connecting both cases.
8. **Generate PDF report** → hashes re-verified, full report downloads with
   custody appendix.

## Known limitations (defense-ready answers)

- **Not court-admissible** — no Section 65B certificate; positioning is triage.
- **Deepfake module is heuristic** — ELA + blur consistency. The service exposes
  `PRETRAINED_MODEL` in `services/deepfake.py` where a FaceForensics++ model
  drops in; we did not ship third-party weights.
- **Synthetic training data** — Isolation Forest fits per-upload on the evidence
  itself (unsupervised); demo data is CERT-style synthetic.
- **Security hardening for production** would add: evidence encryption at rest,
  CORS restriction, rate limiting, forced admin password rotation.
