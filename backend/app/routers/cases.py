import shutil
from datetime import datetime, timedelta
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_role
from ..config import EVIDENCE_STORE, RELATED_EVENT_WINDOW_MIN
from ..services import custody

router = APIRouter(prefix="/api/cases", tags=["cases"])


def _case_or_404(db: Session, case_id: int) -> models.Case:
    case = db.get(models.Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


def _case_out(db: Session, case: models.Case) -> schemas.CaseOut:
    out = schemas.CaseOut.model_validate(case)
    out.evidence_count = db.query(models.Evidence).filter_by(case_id=case.id).count()
    out.flagged_count = db.query(models.FlaggedEvent).filter_by(case_id=case.id).count()
    out.high_risk_count = db.query(models.FlaggedEvent).filter_by(
        case_id=case.id, risk_level="High").count()
    return out


@router.get("", response_model=list[schemas.CaseOut])
def list_cases(db: Session = Depends(get_db), _: models.User = Depends(get_current_user)):
    return [_case_out(db, c) for c in
            db.query(models.Case).order_by(models.Case.created_at.desc()).all()]


@router.post("", response_model=schemas.CaseOut)
def create_case(body: schemas.CaseCreate, db: Session = Depends(get_db),
                user: models.User = Depends(require_role("investigator"))):
    # Numbered off the highest existing suffix for this year, not a row
    # count — a plain count collides with a surviving case's number the
    # moment any case has ever been deleted (counts shrink, numbers don't).
    prefix = f"IT-{datetime.now().year}-"
    existing = db.query(models.Case.case_number).filter(
        models.Case.case_number.like(f"{prefix}%")).all()
    max_seq = 0
    for (num,) in existing:
        suffix = num[len(prefix):]
        if suffix.isdigit():
            max_seq = max(max_seq, int(suffix))
    case = models.Case(case_number=f"{prefix}{max_seq + 1:04d}",
                       name=body.name, description=body.description, opened_by=user.id)
    db.add(case)
    db.commit()
    db.refresh(case)
    custody.log_action(db, action="Case Created", user=user, case_id=case.id,
                       detail=f"{case.case_number}: {case.name}")
    return _case_out(db, case)


@router.get("/{case_id}", response_model=schemas.CaseOut)
def get_case(case_id: int, db: Session = Depends(get_db),
             _: models.User = Depends(get_current_user)):
    return _case_out(db, _case_or_404(db, case_id))


@router.delete("/{case_id}")
def delete_case(case_id: int, db: Session = Depends(get_db),
                _: models.User = Depends(require_role("admin"))):
    """Permanently removes a case and everything attached to it (evidence
    files, findings, custody log, cross-case links, reports). Admin-only —
    unlike closing a case, this destroys the chain of custody rather than
    preserving it, so it's meant for cleaning up test/demo cases, not real
    casework."""
    case = _case_or_404(db, case_id)
    case_number = case.case_number

    for rep in db.query(models.Report).filter_by(case_id=case_id).all():
        Path(rep.file_path).unlink(missing_ok=True)

    case_dir = EVIDENCE_STORE / str(case_id)
    if case_dir.exists():
        shutil.rmtree(case_dir, ignore_errors=True)

    db.query(models.Report).filter_by(case_id=case_id).delete()
    db.query(models.ParsedLogEvent).filter_by(case_id=case_id).delete()
    db.query(models.ExtractedEntity).filter_by(case_id=case_id).delete()
    db.query(models.CrossCaseLink).filter(
        or_(models.CrossCaseLink.case_a == case_id,
            models.CrossCaseLink.case_b == case_id)).delete()
    db.query(models.CustodyLog).filter_by(case_id=case_id).delete()
    db.query(models.FlaggedEvent).filter_by(case_id=case_id).delete()
    db.query(models.Evidence).filter_by(case_id=case_id).delete()
    db.delete(case)
    db.commit()
    return {"deleted": case_id, "case_number": case_number}


@router.patch("/{case_id}/status")
def set_status(case_id: int, status: str, db: Session = Depends(get_db),
               user: models.User = Depends(require_role("investigator"))):
    case = _case_or_404(db, case_id)
    if status not in ("open", "closed"):
        raise HTTPException(status_code=400, detail="status must be open or closed")
    case.status = status
    db.commit()
    custody.log_action(db, action=f"Case marked {status}", user=user, case_id=case.id)
    return {"ok": True, "status": status}


@router.get("/{case_id}/flagged", response_model=list[schemas.FlaggedEventOut])
def flagged_events(case_id: int, db: Session = Depends(get_db),
                   _: models.User = Depends(get_current_user)):
    _case_or_404(db, case_id)
    return (db.query(models.FlaggedEvent).filter_by(case_id=case_id)
            .order_by(models.FlaggedEvent.risk_score.desc()).all())


def _records_analyzed(ev: models.Evidence) -> int | None:
    """Best-effort 'how many records did this file actually contain' figure,
    pulled from whichever module wrote parsed_summary for this evidence —
    used to show flagged-vs-normal ratio, not just a raw flagged count."""
    s = ev.parsed_summary or {}
    for path in (("total_events",), ("log_events", "total_events"),
                ("financial", "total_transactions"), ("total_entries",),
                ("total_rows",)):
        node = s
        for key in path:
            if isinstance(node, dict) and key in node:
                node = node[key]
            else:
                node = None
                break
        if isinstance(node, (int, float)):
            return int(node)
    return None


@router.get("/{case_id}/risk-summary")
def risk_summary(case_id: int, db: Session = Depends(get_db),
                 _: models.User = Depends(get_current_user)):
    """Aggregated, chart-ready view of every finding across every piece of
    evidence in the case — the combined, case-wide risk picture (as opposed
    to /flagged, which returns the raw row list for the table view).
    Computed from FlaggedEvent rows already stored by whichever analysis
    modules have been run — this doesn't run any analysis itself."""
    _case_or_404(db, case_id)
    flags = db.query(models.FlaggedEvent).filter_by(case_id=case_id).all()
    evidence = db.query(models.Evidence).filter_by(case_id=case_id).all()

    by_risk_level: dict[str, int] = {"High": 0, "Medium": 0, "Low": 0}
    by_module: dict[str, int] = {}
    by_evidence: dict[int, dict] = {}
    # case-wide signal ranking: which REASON keeps recurring, and how bad it
    # tends to be — complements by_module (which tool found it) with why
    signal_stats: dict[str, dict] = {}
    # findings over time, bucketed by day, split by risk level — reveals
    # bursts of activity a flat total can't show
    by_day: dict[str, dict] = {}
    # the ACTUAL matched keyword/phrase, not just its category — "winner"
    # and "card number" are different findings even though both are
    # category=scam / financial_probe; a category-only view can't answer
    # "which specific words are showing up"
    keyword_stats: dict[tuple, dict] = {}

    for f in flags:
        by_risk_level[f.risk_level] = by_risk_level.get(f.risk_level, 0) + 1
        for m in (f.module or "").split(","):
            m = m.strip()
            if m:
                by_module[m] = by_module.get(m, 0) + 1
        if f.evidence_id:
            slot = by_evidence.setdefault(
                f.evidence_id, {"High": 0, "Medium": 0, "Low": 0, "total": 0, "event_types": {}})
            slot[f.risk_level] = slot.get(f.risk_level, 0) + 1
            slot["total"] += 1
            et = f.event_type or "unspecified"
            slot["event_types"][et] = slot["event_types"].get(et, 0) + 1

        sig = f.event_type or "unspecified"
        sslot = signal_stats.setdefault(sig, {"count": 0, "max_risk_score": 0.0, "max_risk_level": "Low"})
        sslot["count"] += 1
        if f.risk_score >= sslot["max_risk_score"]:
            sslot["max_risk_score"] = f.risk_score
            sslot["max_risk_level"] = f.risk_level

        if f.event_time:
            day = f.event_time.date().isoformat()
            dslot = by_day.setdefault(day, {"High": 0, "Medium": 0, "Low": 0, "total": 0})
            dslot[f.risk_level] += 1
            dslot["total"] += 1

        meta = f.meta or {}
        match = meta.get("match")
        if match:
            key = (meta.get("category", ""), match.lower())
            kslot = keyword_stats.setdefault(
                key, {"keyword": match, "category": meta.get("category", ""), "count": 0,
                      "max_risk_level": "Low", "max_risk_score": 0.0, "downgraded": False})
            kslot["count"] += 1
            if f.risk_score >= kslot["max_risk_score"]:
                kslot["max_risk_score"] = f.risk_score
                kslot["max_risk_level"] = f.risk_level
            if meta.get("downgraded_receipt_context"):
                kslot["downgraded"] = True

    per_evidence = []
    for ev in evidence:
        stat = by_evidence.get(ev.id, {"High": 0, "Medium": 0, "Low": 0, "total": 0, "event_types": {}})
        top_types = sorted(stat["event_types"].items(), key=lambda kv: -kv[1])[:5]
        per_evidence.append({
            "evidence_id": ev.id, "file_name": ev.file_name, "file_type": ev.file_type,
            "records_analyzed": _records_analyzed(ev), "flagged": stat["total"],
            "high": stat["High"], "medium": stat["Medium"], "low": stat["Low"],
            "top_event_types": [{"event_type": t, "count": c} for t, c in top_types],
        })
    per_evidence.sort(key=lambda e: -e["flagged"])

    top_signals = sorted(
        [{"signal": s, "count": v["count"], "risk_level": v["max_risk_level"]}
         for s, v in signal_stats.items()],
        key=lambda s: -s["count"])[:10]

    top_keywords = sorted(
        [{"keyword": v["keyword"], "category": v["category"], "count": v["count"],
          "risk_level": v["max_risk_level"], "downgraded": v["downgraded"]}
         for v in keyword_stats.values()],
        key=lambda k: -k["count"])[:15]

    timeline_series = [
        {"date": d, "high": v["High"], "medium": v["Medium"], "low": v["Low"], "total": v["total"]}
        for d, v in sorted(by_day.items())
    ]

    return {
        "total_flagged": len(flags),
        "by_risk_level": by_risk_level,
        "by_module": dict(sorted(by_module.items(), key=lambda kv: -kv[1])),
        "per_evidence": per_evidence,
        "top_signals": top_signals,
        "top_keywords": top_keywords,
        "timeline_series": timeline_series,
    }


@router.get("/{case_id}/timeline", response_model=list[schemas.TimelineItem])
def timeline(case_id: int, db: Session = Depends(get_db),
             user: models.User = Depends(get_current_user)):
    _case_or_404(db, case_id)
    # secondary sort by id: two events can legitimately share the same
    # event_time (e.g. several transactions logged at the same minute) —
    # without a tiebreaker, SQL's order among those rows is unspecified and
    # can silently reshuffle between identical requests.
    events = (db.query(models.FlaggedEvent).filter_by(case_id=case_id)
              .filter(models.FlaggedEvent.event_time.isnot(None))
              .order_by(models.FlaggedEvent.event_time.asc(), models.FlaggedEvent.id.asc()).all())
    items: list[schemas.TimelineItem] = []
    prev_time = None
    window = timedelta(minutes=RELATED_EVENT_WINDOW_MIN)
    for fe in events:
        related = prev_time is not None and (fe.event_time - prev_time) <= window
        items.append(schemas.TimelineItem(
            id=fe.id, timestamp=fe.event_time, module=fe.module, event_type=fe.event_type,
            description=fe.description, evidence_id=fe.evidence_id,
            risk_score=fe.risk_score, risk_level=fe.risk_level,
            related_to_previous=related))
        prev_time = fe.event_time
    custody.log_action(db, action="Timeline Reconstructed", user=user, case_id=case_id,
                       detail=f"{len(items)} events included")
    return items


@router.get("/{case_id}/custody", response_model=list[schemas.CustodyOut])
def custody_log(case_id: int, db: Session = Depends(get_db),
                _: models.User = Depends(get_current_user)):
    _case_or_404(db, case_id)
    return (db.query(models.CustodyLog).filter_by(case_id=case_id)
            .order_by(models.CustodyLog.timestamp.asc()).all())


@router.get("/{case_id}/links", response_model=list[schemas.CrossCaseLinkOut])
def cross_case_links(case_id: int, db: Session = Depends(get_db),
                     _: models.User = Depends(get_current_user)):
    _case_or_404(db, case_id)
    links = db.query(models.CrossCaseLink).filter(
        or_(models.CrossCaseLink.case_a == case_id,
            models.CrossCaseLink.case_b == case_id)).all()
    case_ids = {c for link in links for c in (link.case_a, link.case_b)}
    numbers = {c.id: c.case_number for c in
              db.query(models.Case).filter(models.Case.id.in_(case_ids)).all()} if case_ids else {}
    out = []
    for link in links:
        item = schemas.CrossCaseLinkOut.model_validate(link)
        item.case_a_number = numbers.get(link.case_a)
        item.case_b_number = numbers.get(link.case_b)
        out.append(item)
    return out
