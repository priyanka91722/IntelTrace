from pathlib import Path
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import models
from ..database import get_db
from ..auth import require_role
from ..services import custody, anomaly, ocr_chat, financial, deepfake, crosscase, tx_graph

router = APIRouter(prefix="/api", tags=["analysis"])


def _financial_text_blob(ev: models.Evidence) -> str:
    """Text blob fed to cross-case entity extraction after a financial run.
    xlsx is a binary zip container — reading it as text produces garbage, so
    render it as CSV text instead; plain CSV evidence is read as-is."""
    path = Path(ev.storage_path)
    if path.suffix.lower() in (".xlsx", ".xls"):
        try:
            return pd.read_excel(path).astype(str).to_csv(index=False)[:200000]
        except Exception:
            return ""
    return path.read_text(errors="replace")[:200000]


def _evidence_or_404(db: Session, evidence_id: int) -> models.Evidence:
    ev = db.get(models.Evidence, evidence_id)
    if not ev:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return ev


def _clear_previous(db: Session, evidence_id: int, module: str):
    db.query(models.FlaggedEvent).filter_by(evidence_id=evidence_id, module=module).delete()


def _store_flags(db: Session, ev: models.Evidence, module: str, flags: list[dict],
                 default_time=None) -> int:
    for f in flags:
        db.add(models.FlaggedEvent(
            case_id=ev.case_id, evidence_id=ev.id, module=module,
            event_type=f.get("event_type", ""), description=f.get("description", ""),
            event_time=f.get("event_time") or default_time,
            risk_score=f.get("risk_score", 0.0), risk_level=f.get("risk_level", "Low"),
            meta=f.get("meta", {})))
    db.commit()
    return len(flags)


OCR_TEXT_FILE_TYPES = ("chat_screenshot", "image", "pdf", "xlsx")


def _ocr_or_pdf_text(ev: models.Evidence) -> tuple[str, list[dict]]:
    """Text + keyword flags for any OCR/text-eligible evidence: chat
    screenshot/image (Tesseract OCR), a PDF (embedded text via pdfplumber),
    or an xlsx (via the PDF it was converted to at upload time)."""
    if ev.file_type in ("chat_screenshot", "image"):
        return ocr_chat.analyze_screenshot(Path(ev.storage_path))
    if ev.file_type == "pdf":
        return ocr_chat.analyze_pdf(Path(ev.storage_path))
    if ev.file_type == "xlsx":
        pdf_path = (ev.parsed_summary or {}).get("converted_pdf_path")
        if not pdf_path:
            raise RuntimeError("This spreadsheet has no converted PDF on record — "
                               "the xlsx→PDF conversion may have failed at upload time.")
        return ocr_chat.analyze_pdf(Path(pdf_path))
    raise RuntimeError(f"OCR/text analysis does not support file_type={ev.file_type!r}")


@router.post("/evidence/{evidence_id}/analyze/log-anomaly")
def run_log_anomaly(evidence_id: int, db: Session = Depends(get_db),
                    user: models.User = Depends(require_role("investigator"))):
    ev = _evidence_or_404(db, evidence_id)
    rows = db.query(models.ParsedLogEvent).filter_by(evidence_id=ev.id).all()
    if not rows:
        raise HTTPException(status_code=400,
                            detail="No parsed log events for this evidence. Upload it as a "
                                   "log file (Windows Event CSV/.evtx, Linux auth.log, or "
                                   "CERT-style CSV).")
    events = [{"timestamp": r.timestamp, "user": r.user, "event_type": r.event_type,
               "device_id": r.device_id, "filename": r.filename, "source_os": r.source_os}
              for r in rows]
    flags = anomaly.detect(events)
    _clear_previous(db, ev.id, "log_anomaly")
    n = _store_flags(db, ev, "log_anomaly", flags)
    custody.log_action(db, action="Anomaly Detection Performed", user=user,
                       case_id=ev.case_id, evidence_id=ev.id,
                       detail=f"{n} events flagged from {len(events)} normalized log events")
    return {"module": "log_anomaly", "input_events": len(events), "flagged": n}


@router.post("/evidence/{evidence_id}/analyze/ocr-chat")
def run_ocr_chat(evidence_id: int, db: Session = Depends(get_db),
                 user: models.User = Depends(require_role("investigator"))):
    ev = _evidence_or_404(db, evidence_id)
    if ev.file_type not in OCR_TEXT_FILE_TYPES:
        raise HTTPException(status_code=400,
                            detail=f"OCR/text analysis runs on {', '.join(OCR_TEXT_FILE_TYPES)} evidence")
    try:
        text, flags = _ocr_or_pdf_text(ev)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    _clear_previous(db, ev.id, "chat_analysis")
    # No default_time here on purpose: a keyword match has no real timestamp
    # of its own (just a position in a static document), so stamping every
    # match with ev.uploaded_at would pile potentially dozens of distinct
    # findings onto the exact same instant on the Timeline. Leaving
    # event_time null keeps them out of the Timeline (which only shows
    # genuinely-timed events) while they still appear in Flagged events.
    n = _store_flags(db, ev, "chat_analysis", flags)
    verdict = ocr_chat.verdict_summary(flags)
    receipt_fields = ocr_chat.extract_receipt_fields(text)
    summary = dict(ev.parsed_summary or {})
    summary["ocr_chars"] = len(text)
    summary["ocr_preview"] = text[:400]
    summary["ocr_verdict"] = verdict
    if receipt_fields:
        summary["receipt_fields"] = receipt_fields
    ev.parsed_summary = summary
    db.commit()
    links = crosscase.store_and_link(db, ev.case_id, ev.id, text)
    custody.log_action(db, action="OCR + Chat Analysis Performed", user=user,
                       case_id=ev.case_id, evidence_id=ev.id,
                       detail=f"{n} keyword hits, {len(links)} new cross-case links — "
                              f"verdict: {verdict['verdict']}")
    return {"module": "chat_analysis", "ocr_chars": len(text), "flagged": n,
            "new_cross_case_links": len(links), "text_preview": text[:400],
            "verdict": verdict, "receipt_fields": receipt_fields}


@router.post("/evidence/{evidence_id}/analyze/financial")
def run_financial(evidence_id: int, db: Session = Depends(get_db),
                  user: models.User = Depends(require_role("investigator"))):
    ev = _evidence_or_404(db, evidence_id)
    try:
        summary, flags = financial.analyze(Path(ev.storage_path))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Financial analysis failed: {exc}")
    _clear_previous(db, ev.id, "financial")
    n = _store_flags(db, ev, "financial", flags, default_time=ev.uploaded_at)
    ps = dict(ev.parsed_summary or {})
    ps["financial"] = summary
    ev.parsed_summary = ps
    db.commit()
    text_blob = _financial_text_blob(ev)
    links = crosscase.store_and_link(db, ev.case_id, ev.id, text_blob)
    custody.log_action(db, action="Financial Analysis Performed", user=user,
                       case_id=ev.case_id, evidence_id=ev.id,
                       detail=f"{n} suspicious transactions flagged")
    return {"module": "financial", **summary, "flagged": n,
            "new_cross_case_links": len(links)}


@router.post("/cases/{case_id}/analyze/transaction-graph")
def run_transaction_graph(case_id: int, db: Session = Depends(get_db),
                          user: models.User = Depends(require_role("investigator"))):
    """Case-level (not evidence-level) analysis: some datasets only make
    sense joined across multiple uploaded files — a features table, a
    labels/classes table and a relationship/edge-list table. This scans
    every evidence item in the case, identifies which file plays which role
    by structure (see services/tx_graph.py::classify_transaction_file — not
    filename matching, so this works for any case shaped like this, not one
    specific dataset), and runs the joined analysis if all three are found."""
    case = db.get(models.Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    evidence = db.query(models.Evidence).filter_by(case_id=case_id).all()
    roles: dict[str, models.Evidence] = {}
    for ev in evidence:
        path = Path(ev.storage_path)
        if not path.exists():
            continue
        role = tx_graph.classify_transaction_file(path)
        if role in ("features", "classes", "edges") and role not in roles:
            roles[role] = ev

    missing = [r for r in ("features", "classes", "edges") if r not in roles]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=("Transaction-graph analysis needs a features file, a labels/classes file "
                     "and a relationship/edge-list file uploaded to this case — missing: "
                     f"{', '.join(missing)}."))

    try:
        summary, flags = tx_graph.analyze(Path(roles["features"].storage_path),
                                          Path(roles["classes"].storage_path),
                                          Path(roles["edges"].storage_path))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Transaction graph analysis failed: {exc}")

    anchor = roles["features"]
    db.query(models.FlaggedEvent).filter_by(case_id=case_id, module="financial_graph").delete()
    for f in flags:
        db.add(models.FlaggedEvent(
            case_id=case_id, evidence_id=anchor.id, module="financial_graph",
            event_type=f.get("event_type", ""), description=f.get("description", ""),
            event_time=f.get("event_time"), risk_score=f.get("risk_score", 0.0),
            risk_level=f.get("risk_level", "Low"), meta=f.get("meta", {})))
    db.commit()
    custody.log_action(
        db, action="Transaction Graph Analysis Performed", user=user, case_id=case_id,
        detail=(f"features={roles['features'].file_name}, classes={roles['classes'].file_name}, "
                f"edges={roles['edges'].file_name} — {len(flags)} flagged"))
    return {"module": "financial_graph", **summary, "flagged": len(flags),
            "files": {k: v.file_name for k, v in roles.items()}}


def _fmt_video_ts(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m}:{s:02d}"


def _media_flags(ev: models.Evidence, result: dict) -> list[dict]:
    """Aggregate whole-file verdict (event_time = upload time, since that's
    the only real-world instant this analysis has) plus one finding per
    suspicious video frame with its in-video timestamp (event_time left
    null — 'x seconds into the clip' isn't a calendar time, so it's stated
    in the description instead of faked onto the Timeline)."""
    flags = []
    if result["verdict"] in ("likely_manipulated", "suspicious"):
        flags.append({
            "event_type": f"media_{result['verdict']}",
            "description": f"Media verification: {ev.file_name} judged "
                           f"{result['verdict'].replace('_', ' ')} "
                           f"(score {result['risk_score']}, {result['method']})",
            "risk_score": result["risk_score"],
            "risk_level": "High" if result["risk_score"] >= 70 else "Medium",
            "event_time": ev.uploaded_at,
            "meta": result,
        })
    for ff in result.get("frame_findings", []):
        flags.append({
            "event_type": "media_frame_anomaly",
            "description": f"{ev.file_name}: face/background sharpness inconsistency at "
                           f"{_fmt_video_ts(ff['timestamp_sec'])} into the video "
                           f"(inconsistency {ff['inconsistency']}).",
            "risk_score": ff["risk_score"],
            "risk_level": "High" if ff["risk_score"] >= 70 else "Medium",
            "meta": {**ff, "kind": "video_frame"},
        })
    return flags


@router.post("/evidence/{evidence_id}/analyze/media")
def run_media_verification(evidence_id: int, db: Session = Depends(get_db),
                           user: models.User = Depends(require_role("investigator"))):
    ev = _evidence_or_404(db, evidence_id)
    if ev.file_type not in ("image", "video", "chat_screenshot"):
        raise HTTPException(status_code=400, detail="Media verification runs on image/video evidence")
    result = deepfake.analyze_media(Path(ev.storage_path),
                                    "video" if ev.file_type == "video" else "image")
    _clear_previous(db, ev.id, "media_verification")
    flags = _media_flags(ev, result)
    n = _store_flags(db, ev, "media_verification", flags)
    ps = dict(ev.parsed_summary or {})
    ps["media_verification"] = result
    ev.parsed_summary = ps
    db.commit()
    custody.log_action(db, action="Media Verification Performed", user=user,
                       case_id=ev.case_id, evidence_id=ev.id,
                       detail=f"verdict={result['verdict']} score={result['risk_score']}")
    return {"module": "media_verification", **result, "flagged": n}


@router.post("/evidence/{evidence_id}/analyze/deepfake-manifest")
def run_deepfake_manifest(evidence_id: int, db: Session = Depends(get_db),
                          user: models.User = Depends(require_role("investigator"))):
    """Liveness/spoof LABEL manifest (e.g. CelebA-Spoof-shaped exports) —
    distinct from /analyze/media, which runs pixel-level heuristics on an
    actual image/video. This ingests a labels-only JSON (no image bytes)
    and reports on it; see services/deepfake.py::analyze_manifest."""
    ev = _evidence_or_404(db, evidence_id)
    if ev.file_type != "deepfake_manifest":
        raise HTTPException(status_code=400,
                            detail="This runs on a deepfake/liveness label manifest (JSON)")
    try:
        summary, flags = deepfake.analyze_manifest(Path(ev.storage_path))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Manifest analysis failed: {exc}")
    _clear_previous(db, ev.id, "deepfake_manifest")
    # No default_time: these are aggregate stats over the whole manifest (one
    # finding per spoof type, not per image), with no real timestamp of
    # their own — same reasoning as chat_analysis above.
    n = _store_flags(db, ev, "deepfake_manifest", flags)
    ps = dict(ev.parsed_summary or {})
    ps["deepfake_manifest"] = summary
    ev.parsed_summary = ps
    db.commit()
    custody.log_action(db, action="Deepfake Manifest Analysis Performed", user=user,
                       case_id=ev.case_id, evidence_id=ev.id,
                       detail=f"{summary['spoof']}/{summary['total_entries']} labeled spoof — "
                              f"{n} findings")
    return {"module": "deepfake_manifest", **summary, "flagged": n}


def _applicable_modules(ev: models.Evidence) -> list[str]:
    """Which modules can analyze this evidence. Every tabular upload (log
    or xlsx) is content-probed at upload time (see routers/evidence.py::
    _ingest_log_events / _looks_financial) — parsed_summary reflects what
    was ACTUALLY found in the file, not what the declared file_type
    assumed. log_anomaly is only offered when the log parse found a real
    recognized format (log_parse_confidence=="high"), not the generic-CSV
    fallback that a non-log CSV (e.g. a plain relational/graph export) also
    produces one row per input line for."""
    mods = []
    summary = ev.parsed_summary or {}
    high_confidence_log = summary.get("log_parse_confidence") == "high"
    if (ev.file_type == "log" and high_confidence_log) or \
       (ev.file_type == "xlsx" and summary.get("log_events")):
        mods.append("log_anomaly")
    if ev.file_type in OCR_TEXT_FILE_TYPES:
        mods.append("chat_analysis")
    if ev.file_type in ("image", "video", "chat_screenshot"):
        mods.append("media_verification")
    if (ev.file_type == "financial_csv"
            or (ev.file_type == "other" and ev.file_name.lower().endswith(".csv"))
            or (ev.file_type in ("log", "xlsx") and summary.get("looks_financial"))):
        mods.append("financial")
    if ev.file_type == "deepfake_manifest":
        mods.append("deepfake_manifest")
    return mods


def _run_modules_for_evidence(db: Session, ev: models.Evidence, applicable: list[str]):
    """Run every applicable module for one evidence item. Returns
    (flags, entities, new_links, modules_ran, errors) — flags and entities
    are tagged with which module(s) produced them so the caller can
    de-duplicate and correlate across the whole case."""
    flags: list[dict] = []
    entities: dict[str, dict] = {}
    new_links: list[models.CrossCaseLink] = []
    ran: set[str] = set()
    errors: list[dict] = []

    def record_entities(text: str, module: str):
        for etype, val in crosscase.extract_entities(text):
            slot = entities.setdefault(val, {"type": etype, "modules": set()})
            slot["modules"].add(module)
        new_links.extend(crosscase.store_and_link(db, ev.case_id, ev.id, text))

    if "log_anomaly" in applicable:
        rows = db.query(models.ParsedLogEvent).filter_by(evidence_id=ev.id).all()
        if rows:
            events = [{"timestamp": r.timestamp, "user": r.user, "event_type": r.event_type,
                      "device_id": r.device_id, "filename": r.filename, "source_os": r.source_os}
                     for r in rows]
            try:
                for f in anomaly.detect(events):
                    flags.append({**f, "evidence_id": ev.id, "modules_flagged": ["log_anomaly"]})
                ran.add("log_anomaly")
            except Exception as exc:
                errors.append({"evidence_id": ev.id, "file": ev.file_name,
                               "module": "log_anomaly", "error": str(exc)})

    if "chat_analysis" in applicable:
        try:
            text, raw_flags = _ocr_or_pdf_text(ev)
        except RuntimeError as exc:
            errors.append({"evidence_id": ev.id, "file": ev.file_name,
                           "module": "chat_analysis", "error": str(exc)})
        else:
            # no ev.uploaded_at fallback — see the comment in run_ocr_chat
            for f in raw_flags:
                flags.append({**f, "evidence_id": ev.id, "modules_flagged": ["chat_analysis"]})
            ran.add("chat_analysis")
            receipt_fields = ocr_chat.extract_receipt_fields(text)
            ps = dict(ev.parsed_summary or {})
            ps["ocr_chars"] = len(text)
            ps["ocr_preview"] = text[:400]
            ps["ocr_verdict"] = ocr_chat.verdict_summary(raw_flags)
            if receipt_fields:
                ps["receipt_fields"] = receipt_fields
            ev.parsed_summary = ps
            record_entities(text, "chat_analysis")

    if "financial" in applicable:
        try:
            summary, raw_flags = financial.analyze(Path(ev.storage_path))
        except Exception as exc:
            errors.append({"evidence_id": ev.id, "file": ev.file_name,
                           "module": "financial", "error": str(exc)})
        else:
            for f in raw_flags:
                flags.append({**f, "event_time": f.get("event_time") or ev.uploaded_at,
                             "evidence_id": ev.id, "modules_flagged": ["financial"]})
            ran.add("financial")
            ps = dict(ev.parsed_summary or {})
            ps["financial"] = summary
            ev.parsed_summary = ps
            record_entities(_financial_text_blob(ev), "financial")

    if "media_verification" in applicable:
        try:
            result = deepfake.analyze_media(Path(ev.storage_path),
                                            "video" if ev.file_type == "video" else "image")
        except Exception as exc:
            errors.append({"evidence_id": ev.id, "file": ev.file_name,
                           "module": "media_verification", "error": str(exc)})
        else:
            ran.add("media_verification")
            ps = dict(ev.parsed_summary or {})
            ps["media_verification"] = result
            ev.parsed_summary = ps
            for f in _media_flags(ev, result):
                flags.append({**f, "evidence_id": ev.id, "modules_flagged": ["media_verification"]})

    if "deepfake_manifest" in applicable:
        try:
            summary, raw_flags = deepfake.analyze_manifest(Path(ev.storage_path))
        except Exception as exc:
            errors.append({"evidence_id": ev.id, "file": ev.file_name,
                           "module": "deepfake_manifest", "error": str(exc)})
        else:
            # no ev.uploaded_at fallback — see the comment in run_deepfake_manifest
            for f in raw_flags:
                flags.append({**f, "evidence_id": ev.id, "modules_flagged": ["deepfake_manifest"]})
            ran.add("deepfake_manifest")
            ps = dict(ev.parsed_summary or {})
            ps["deepfake_manifest"] = summary
            ev.parsed_summary = ps

    db.commit()
    return flags, entities, new_links, ran, errors


def _merge_corroborated_flags(db: Session, case_id: int) -> int:
    """Second pass over ALREADY-STORED flags: rows from different modules/
    evidence sharing the same (event_type, event_time) are almost certainly
    the same real-world event seen by more than one analyzer — merge them
    into one higher-confidence row, same intent as the old pre-storage
    dedupe. Runs AFTER storage rather than before so an interrupted batch
    (see run_all) still keeps every individually-stored finding — at worst
    a large batch ends with some not-yet-merged duplicates instead of
    losing the findings outright."""
    rows = (db.query(models.FlaggedEvent).filter_by(case_id=case_id)
            .filter(models.FlaggedEvent.event_time.isnot(None)).all())
    groups: dict[tuple, list] = {}
    for r in rows:
        groups.setdefault((r.event_type, r.event_time), []).append(r)

    merged_away = 0
    for group in groups.values():
        if len(group) < 2:
            continue
        survivor = max(group, key=lambda r: r.risk_score)
        modules = sorted({m.strip() for r in group for m in (r.module or "").split(",") if m.strip()})
        survivor.module = ", ".join(modules)
        if len(modules) > 1:
            survivor.confidence = 1.0
        meta = dict(survivor.meta or {})
        meta["corroborated_by"] = modules
        meta["merged_evidence_ids"] = sorted({r.evidence_id for r in group if r.evidence_id is not None})
        survivor.meta = meta
        for r in group:
            if r.id != survivor.id:
                db.delete(r)
        merged_away += len(group) - 1
    db.commit()
    return merged_away


@router.post("/cases/{case_id}/analyze/all")
def run_all(case_id: int, db: Session = Depends(get_db),
           user: models.User = Depends(require_role("investigator"))):
    """Run every applicable module across every evidence item in the case.
    Each evidence item's findings are committed as soon as that item
    finishes (see _run_modules_for_evidence), not batched up for one giant
    insert at the end — a case with hundreds of files (each needing OCR)
    can legitimately take long enough that the request gets interrupted
    partway through, and the old all-at-the-end insert meant that silently
    discarded every finding gathered so far. Corroboration across
    modules/evidence still happens, as a best-effort merge pass over what's
    already durably stored (see _merge_corroborated_flags)."""
    case = db.get(models.Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    evidence_list = db.query(models.Evidence).filter_by(case_id=case_id).all()
    custody.log_action(db, action="Multi-module analysis started", user=user, case_id=case_id,
                       detail=f"Orchestrating analysis across {len(evidence_list)} evidence item(s)")

    # clear this case's prior flagged events for the evidence being re-analyzed,
    # so re-running "all modules" doesn't pile up duplicate rows
    ev_ids = [ev.id for ev in evidence_list]
    if ev_ids:
        db.query(models.FlaggedEvent).filter(models.FlaggedEvent.evidence_id.in_(ev_ids)).delete(
            synchronize_session=False)
        db.commit()

    all_entities: dict[str, dict] = {}
    modules_run: set[str] = set()
    total_new_links = 0
    errors: list[dict] = []
    total_stored = 0

    for ev in evidence_list:
        applicable = _applicable_modules(ev)
        if not applicable:
            continue
        flags, entities, new_links, ran, ev_errors = _run_modules_for_evidence(db, ev, applicable)
        for f in flags:
            db.add(models.FlaggedEvent(
                case_id=case_id, evidence_id=f.get("evidence_id"),
                module=", ".join(f["modules_flagged"]),
                event_type=f.get("event_type", ""), description=f.get("description", ""),
                event_time=f.get("event_time"),
                risk_score=f.get("risk_score", 0.0), risk_level=f.get("risk_level", "Low"),
                confidence=0.7, meta=f.get("meta") or {}))
        total_stored += len(flags)
        db.commit()
        for val, info in entities.items():
            slot = all_entities.setdefault(val, {"type": info["type"], "modules": set()})
            slot["modules"] |= info["modules"]
        modules_run |= ran
        total_new_links += len(new_links)
        errors.extend(ev_errors)

    merged_away = _merge_corroborated_flags(db, case_id)
    total_after = total_stored - merged_away

    entity_preview = ", ".join(sorted(all_entities)[:5])
    if len(all_entities) > 5:
        entity_preview += ", …"
    custody_detail = (
        f"Modules run: {', '.join(sorted(modules_run)) or 'none'}. "
        f"Total findings: {total_after}" +
        (f" (corroborated from {total_stored} raw flags)" if merged_away else "") + ". "
        f"Unique entities: {len(all_entities)}" + (f" ({entity_preview})" if all_entities else "") + ". "
        f"Cross-case links: {total_new_links}."
    )
    if errors:
        custody_detail += " Skipped: " + "; ".join(f"{e['module']} on {e['file']} ({e['error']})" for e in errors)
    custody.log_action(db, action="Analysis orchestration complete", user=user, case_id=case_id,
                       detail=custody_detail, modules_involved=sorted(modules_run),
                       entities_found=len(all_entities), cross_case_links=total_new_links)

    return {
        "ok": True,
        "case_id": case_id,
        "evidence_analyzed": len(evidence_list),
        "modules": sorted(modules_run),
        "total_flagged_before_dedup": total_stored,
        "total_flagged_after_dedup": total_after,
        "flagged": total_after,
        "unique_entities": len(all_entities),
        "cross_case_links": total_new_links,
        "errors": errors,
    }
