from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session
from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_role
from ..services import certificate_pdf, custody, report_pdf
from ..services.hashing import sha256_file

router = APIRouter(prefix="/api", tags=["reports"])


@router.post("/cases/{case_id}/report")
def generate_report(case_id: int, db: Session = Depends(get_db),
                    user: models.User = Depends(require_role("investigator"))):
    case = db.get(models.Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    evidence = db.query(models.Evidence).filter_by(case_id=case_id).all()
    # final integrity re-check before reporting
    for ev in evidence:
        p = Path(ev.storage_path)
        if p.exists():
            ev.current_hash = sha256_file(p)
            ev.integrity_status = ("Verified" if ev.current_hash == ev.original_hash
                                   else "TAMPERED — hash mismatch")
        else:
            ev.integrity_status = "MISSING — raw file not found"
    db.commit()

    flagged = (db.query(models.FlaggedEvent).filter_by(case_id=case_id)
               .order_by(models.FlaggedEvent.risk_score.desc()).all())
    timeline_rows = [fe for fe in flagged if fe.event_time]
    timeline_rows.sort(key=lambda fe: fe.event_time)
    timeline = [{"timestamp": fe.event_time, "module": fe.module,
                 "description": fe.description, "risk_score": fe.risk_score}
                for fe in timeline_rows]
    links = db.query(models.CrossCaseLink).filter(
        or_(models.CrossCaseLink.case_a == case_id,
            models.CrossCaseLink.case_b == case_id)).all()
    link_case_ids = {c for link in links for c in (link.case_a, link.case_b)}
    link_case_numbers = ({c.id: c.case_number for c in
                          db.query(models.Case).filter(models.Case.id.in_(link_case_ids)).all()}
                         if link_case_ids else {})
    for link in links:
        link.case_a_number = link_case_numbers.get(link.case_a)
        link.case_b_number = link_case_numbers.get(link.case_b)
    custody_entries = (db.query(models.CustodyLog).filter_by(case_id=case_id)
                       .order_by(models.CustodyLog.timestamp.asc()).all())

    path = report_pdf.generate(case, evidence, flagged, timeline, links,
                               custody_entries, generated_by=user.full_name or user.username)
    rep = models.Report(case_id=case_id, file_path=str(path), generated_by=user.id)
    db.add(rep)
    db.commit()
    custody.log_action(db, action="Forensic Report Generated", user=user,
                       case_id=case_id, detail=path.name)
    return {"report_id": rep.id, "file": path.name,
            "download_url": f"/api/reports/{rep.id}/download"}


@router.get("/reports/{report_id}/download")
def download_report(report_id: int, db: Session = Depends(get_db),
                    _: models.User = Depends(get_current_user)):
    rep = db.get(models.Report, report_id)
    if not rep or not Path(rep.file_path).exists():
        raise HTTPException(status_code=404, detail="Report not found")
    return FileResponse(rep.file_path, media_type="application/pdf",
                        filename=Path(rep.file_path).name)


@router.post("/cases/{case_id}/certificate")
def generate_certificate(case_id: int, body: schemas.CertificateRequest,
                         db: Session = Depends(get_db),
                         user: models.User = Depends(require_role("investigator"))):
    """Drafts a Section 65B(4) certificate — see services/certificate_pdf.py
    for why this is explicitly a DRAFT: IntelTrace can attest to its own
    records (hashes, custody log) but not to the source device's regular
    use/proper operation, which only the signing officer can certify."""
    case = db.get(models.Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    evidence = db.query(models.Evidence).filter_by(case_id=case_id).all()
    if not evidence:
        raise HTTPException(status_code=400,
                            detail="This case has no evidence to certify yet")
    # final integrity re-check, same as the forensic report
    for ev in evidence:
        p = Path(ev.storage_path)
        if p.exists():
            ev.current_hash = sha256_file(p)
            ev.integrity_status = ("Verified" if ev.current_hash == ev.original_hash
                                   else "TAMPERED — hash mismatch")
        else:
            ev.integrity_status = "MISSING — raw file not found"
    db.commit()

    custody_entries = (db.query(models.CustodyLog).filter_by(case_id=case_id)
                       .order_by(models.CustodyLog.timestamp.asc()).all())

    path = certificate_pdf.generate(
        case, evidence, custody_entries,
        officer_name=body.officer_name, officer_designation=body.officer_designation,
        place=body.place, signature_data_url=body.signature_data_url,
        requested_by=user.full_name or user.username)

    cert = models.Certificate(case_id=case_id, file_path=str(path),
                              officer_name=body.officer_name,
                              officer_designation=body.officer_designation,
                              place=body.place, generated_by=user.id)
    db.add(cert)
    db.commit()
    custody.log_action(db, action="65B Certificate Drafted", user=user, case_id=case_id,
                       detail=f"{path.name} — officer: {body.officer_name} "
                              f"({body.officer_designation})")
    return {"certificate_id": cert.id, "file": path.name,
            "download_url": f"/api/certificates/{cert.id}/download"}


@router.get("/certificates/{certificate_id}/download")
def download_certificate(certificate_id: int, db: Session = Depends(get_db),
                         _: models.User = Depends(get_current_user)):
    cert = db.get(models.Certificate, certificate_id)
    if not cert or not Path(cert.file_path).exists():
        raise HTTPException(status_code=404, detail="Certificate not found")
    return FileResponse(cert.file_path, media_type="application/pdf",
                        filename=Path(cert.file_path).name)
