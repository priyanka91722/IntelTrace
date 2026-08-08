import re
import shutil
from pathlib import Path
import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_role
from ..config import EVIDENCE_STORE, MAX_UPLOAD_MB
from ..services import custody, deepfake, financial, parsers, xlsx_convert
from ..services.hashing import sha256_file

router = APIRouter(prefix="/api", tags=["evidence"])

FILE_TYPES = {"log", "chat_screenshot", "financial_csv", "image", "video", "pdf", "xlsx",
             "deepfake_manifest", "other"}

_EXT_GUESS = {
    ".csv": "log", ".log": "log", ".txt": "log", ".evtx": "log",
    ".png": "image", ".jpg": "image", ".jpeg": "image", ".webp": "image",
    ".mp4": "video", ".avi": "video", ".mov": "video", ".mkv": "video",
    ".pdf": "pdf",
    ".xlsx": "xlsx", ".xls": "xlsx",
    ".json": "deepfake_manifest",
}


def _safe_name(name: str) -> str:
    return re.sub(r"[^\w.\-]", "_", name)[:180]


def _ingest_log_events(path: Path, ev: models.Evidence, case_id: int, db: Session) -> dict:
    """Content-verified log ingestion, shared by every evidence type that
    might contain log-shaped data (not just file_type=="log") — this is the
    single place that decides whether a file's rows actually get stored as
    ParsedLogEvent (and therefore become eligible for log-anomaly
    detection), based on what parsers.detect_and_parse_log actually found,
    not on the label the file was uploaded under."""
    try:
        detected, events = parsers.detect_and_parse_log(path)
    except Exception as exc:
        return {"parse_error": str(exc)}

    log_summary = parsers.summarize(events)
    log_summary["detected_format"] = detected
    if detected in parsers.LOW_CONFIDENCE_LOG_FORMATS or not events:
        # still tell the analyst what was read, but don't pollute the DB with
        # hundreds of thousands of near-empty rows from a file that just
        # happens to be CSV-shaped without being log-shaped
        log_summary["log_parse_confidence"] = "low"
        return log_summary

    log_summary["log_parse_confidence"] = "high"
    oses = log_summary.get("source_os") or []
    ev.source_os = oses[0] if len(oses) == 1 else ("mixed" if oses else "")
    for e in events:
        db.add(models.ParsedLogEvent(
            evidence_id=ev.id, case_id=case_id, timestamp=e["timestamp"],
            user=e["user"], event_type=e["event_type"], device_id=e["device_id"],
            filename=e["filename"], source_os=e["source_os"], raw=e["raw"]))
    return log_summary


def _looks_financial(path: Path) -> bool:
    """Content probe, shared regardless of declared file type: does this
    tabular file have an amount-like column plus a sender/receiver-like
    column? services/financial.py already reads .csv/.xlsx directly, so
    this only decides whether it's worth offering that analysis."""
    try:
        df = (pd.read_excel(path) if path.suffix.lower() in (".xlsx", ".xls")
              else pd.read_csv(path, nrows=200))
    except Exception:
        return False
    amt_c = financial._find_col(df, "amount", "amt", "value", "debit", "credit")
    party_c = financial._find_col(df, "from", "sender", "payer", "source_account",
                                  "to", "receiver", "payee", "beneficiary", "account")
    return bool(amt_c and party_c)


@router.post("/cases/{case_id}/evidence", response_model=schemas.EvidenceOut)
def upload_evidence(case_id: int,
                    file: UploadFile = File(...),
                    file_type: str = Form("auto"),
                    machine_id: str = Form("unknown"),
                    db: Session = Depends(get_db),
                    user: models.User = Depends(require_role("investigator"))):
    case = db.get(models.Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    fname = _safe_name(file.filename or "evidence.bin")
    ext = Path(fname).suffix.lower()
    if file_type == "auto":
        file_type = _EXT_GUESS.get(ext, "other")
    if file_type not in FILE_TYPES:
        raise HTTPException(status_code=400, detail=f"file_type must be one of {sorted(FILE_TYPES)}")

    # STEP 2: store raw evidence at /evidence_store/{case}/{machine}/{id}_{name}
    dest_dir = EVIDENCE_STORE / str(case_id) / _safe_name(machine_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = dest_dir / f"__incoming_{fname}"
    size = 0
    with open(tmp_path, "wb") as out:
        while chunk := file.file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_MB * 1024 * 1024:
                out.close()
                tmp_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail=f"File exceeds {MAX_UPLOAD_MB} MB limit")
            out.write(chunk)

    ev = models.Evidence(case_id=case_id, machine_id=machine_id, file_name=fname,
                         file_type=file_type, file_size=size, storage_path="",
                         original_hash="pending", uploaded_by=user.id)
    db.add(ev)
    db.flush()
    final_path = dest_dir / f"{ev.id}_{fname}"
    shutil.move(tmp_path, final_path)
    ev.storage_path = str(final_path)

    # STEP 3: original SHA-256 fingerprint
    ev.original_hash = sha256_file(final_path)

    # STEP 4: parse into structured form. Every tabular type (log, xlsx, and
    # anything else CSV/Excel-shaped) is run through the SAME content-based
    # probes — log ingestion and the financial-ledger check — rather than
    # trusting the declared/guessed file_type. That's what lets a file that
    # was auto-typed "log" by extension but isn't actually log-shaped (e.g.
    # a plain relational/graph CSV) still get correctly routed to whichever
    # analysis actually fits, instead of only offering log-anomaly detection
    # on data with no real log signal.
    summary = {}
    if file_type == "log":
        summary = _ingest_log_events(final_path, ev, case_id, db)
        if summary.get("log_parse_confidence") != "high" and _looks_financial(final_path):
            summary["looks_financial"] = True
    elif file_type == "xlsx":
        # the ORIGINAL workbook (already hashed above) is never touched — this
        # writes a brand-new derived PDF alongside it so the spreadsheet can be
        # accepted into the same PDF-text analysis path as other documents
        # (see services/ocr_chat.py::analyze_pdf, run via /analyze/ocr-chat)
        converted_pdf = dest_dir / f"{ev.id}_converted.pdf"
        try:
            stats = xlsx_convert.convert_to_pdf(final_path, converted_pdf)
            summary = {**stats, "converted_pdf_path": str(converted_pdf)}
        except Exception as exc:  # keep the evidence, record the conversion failure
            summary = {"conversion_error": str(exc)}

        log_summary = _ingest_log_events(final_path, ev, case_id, db)
        if log_summary.get("log_parse_confidence") == "high":
            summary["log_events"] = log_summary
        if _looks_financial(final_path):
            summary["looks_financial"] = True
    elif file_type == "deepfake_manifest":
        try:
            manifest_summary, _ = deepfake.analyze_manifest(final_path)
            summary = {"total_entries": manifest_summary["total_entries"],
                       "live": manifest_summary["live"], "spoof": manifest_summary["spoof"]}
        except Exception as exc:  # keep the evidence, record the parse failure
            summary = {"parse_error": str(exc)}
    ev.parsed_summary = summary

    # STEP 5-6: re-hash the SAME raw file, compare
    ev.current_hash = sha256_file(final_path)
    ev.integrity_status = ("Verified" if ev.current_hash == ev.original_hash
                           else "TAMPERED — altered during processing")
    db.commit()
    db.refresh(ev)

    custody.log_action(db, action="Evidence Collected, Hashed and Parsed", user=user,
                       case_id=case_id, evidence_id=ev.id,
                       detail=f"{fname} ({file_type}, {size} bytes) sha256={ev.original_hash[:16]}… "
                              f"status={ev.integrity_status}")
    return ev


@router.get("/cases/{case_id}/evidence", response_model=list[schemas.EvidenceOut])
def list_evidence(case_id: int, db: Session = Depends(get_db),
                  _: models.User = Depends(get_current_user)):
    return (db.query(models.Evidence).filter_by(case_id=case_id)
            .order_by(models.Evidence.uploaded_at.desc()).all())


@router.post("/evidence/{evidence_id}/verify", response_model=schemas.EvidenceOut)
def verify_integrity(evidence_id: int, db: Session = Depends(get_db),
                     user: models.User = Depends(get_current_user)):
    ev = db.get(models.Evidence, evidence_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")
    if not Path(ev.storage_path).exists():
        ev.integrity_status = "MISSING — raw file not found on disk"
    else:
        ev.current_hash = sha256_file(ev.storage_path)
        ev.integrity_status = ("Verified" if ev.current_hash == ev.original_hash
                               else "TAMPERED — hash mismatch")
    db.commit()
    db.refresh(ev)
    custody.log_action(db, action="Integrity Re-Verified", user=user,
                       case_id=ev.case_id, evidence_id=ev.id, detail=ev.integrity_status)
    return ev
