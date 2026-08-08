"""Cross-case link detection.
Regex-extracts identifying entities (phone, bank account, IP, email, UPI)
from every piece of text evidence, stores them, and flags when the same
entity appears in a DIFFERENT case."""
from __future__ import annotations
import re
from sqlalchemy.orm import Session
from .. import models

ENTITY_PATTERNS = {
    "phone": re.compile(r"(?:\+91[\-\s]?)?[6-9]\d{9}\b"),
    "email": re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b"),
    "ip": re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b"),
    "upi": re.compile(r"\b[\w.\-]{2,}@(?:ybl|okaxis|okhdfcbank|oksbi|okicici|paytm|upi|apl|ibl)\b", re.I),
    "account": re.compile(r"\b\d{11,18}\b"),
}


def extract_entities(text: str) -> list[tuple[str, str]]:
    found = []
    seen = set()
    for etype, pattern in ENTITY_PATTERNS.items():
        for m in pattern.finditer(text):
            val = m.group(0).strip()
            if etype == "account" and re.match(r"^[6-9]\d{9}$", val):
                continue  # already captured as phone
            key = (etype, val)
            if key not in seen:
                seen.add(key)
                found.append(key)
    return found


def store_and_link(db: Session, case_id: int, evidence_id: int, text: str) -> list[models.CrossCaseLink]:
    entities = extract_entities(text)
    new_links = []
    for etype, value in entities:
        exists = db.query(models.ExtractedEntity).filter_by(
            case_id=case_id, evidence_id=evidence_id,
            entity_type=etype, entity_value=value).first()
        if not exists:
            db.add(models.ExtractedEntity(case_id=case_id, evidence_id=evidence_id,
                                          entity_type=etype, entity_value=value))
        # same entity in another case?
        matches = db.query(models.ExtractedEntity).filter(
            models.ExtractedEntity.entity_value == value,
            models.ExtractedEntity.case_id != case_id).all()
        for m in matches:
            dup = db.query(models.CrossCaseLink).filter_by(
                entity_value=value, case_a=min(case_id, m.case_id),
                case_b=max(case_id, m.case_id)).first()
            if not dup:
                link = models.CrossCaseLink(
                    entity_type=etype, entity_value=value,
                    case_a=min(case_id, m.case_id), case_b=max(case_id, m.case_id),
                    evidence_a=evidence_id, evidence_b=m.evidence_id)
                db.add(link)
                new_links.append(link)
    db.commit()
    return new_links
