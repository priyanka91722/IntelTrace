from datetime import datetime, timezone
from sqlalchemy import (Column, Integer, String, Float, DateTime, Text,
                        ForeignKey, JSON, Boolean)
from sqlalchemy.orm import relationship
from .database import Base


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    full_name = Column(String(128), default="")
    password_hash = Column(String(256), nullable=False)
    role = Column(String(20), nullable=False, default="viewer")  # admin | investigator | viewer
    created_at = Column(DateTime, default=utcnow)


class Case(Base):
    __tablename__ = "cases"
    id = Column(Integer, primary_key=True)
    case_number = Column(String(40), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, default="")
    status = Column(String(20), default="open")  # open | closed
    opened_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=utcnow)

    evidence = relationship("Evidence", back_populates="case", cascade="all, delete-orphan")
    flagged_events = relationship("FlaggedEvent", back_populates="case", cascade="all, delete-orphan")


class Evidence(Base):
    __tablename__ = "evidence"
    id = Column(Integer, primary_key=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    machine_id = Column(String(64), default="unknown")
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(30), nullable=False)   # log | chat_screenshot | financial_csv | image | video | pdf | other
    file_size = Column(Integer, default=0)
    storage_path = Column(String(500), nullable=False)
    original_hash = Column(String(64), nullable=False)
    current_hash = Column(String(64))
    integrity_status = Column(String(40), default="Verified")  # Verified | TAMPERED
    source_os = Column(String(20), default="")       # windows | linux | n/a (set by log parsers)
    parsed_summary = Column(JSON, default=dict)      # parser output stats
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(DateTime, default=utcnow)

    case = relationship("Case", back_populates="evidence")


class ParsedLogEvent(Base):
    """Normalized cross-OS log schema. Every log parser (Windows evtx/CSV,
    Linux auth.log, CERT CSV, generic CSV) writes rows in this ONE format,
    so anomaly detection never cares which OS the evidence came from."""
    __tablename__ = "parsed_log_events"
    id = Column(Integer, primary_key=True)
    evidence_id = Column(Integer, ForeignKey("evidence.id"), nullable=False, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    timestamp = Column(DateTime, index=True)
    user = Column(String(128), default="")
    event_type = Column(String(40), default="other")  # logon|logoff|usb_connect|usb_disconnect|file_access|file_delete|file_transfer|account_change|other
    device_id = Column(String(128), default="")
    filename = Column(String(300), default="")
    source_os = Column(String(20), default="")
    raw = Column(Text, default="")


class FlaggedEvent(Base):
    __tablename__ = "flagged_events"
    id = Column(Integer, primary_key=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    evidence_id = Column(Integer, ForeignKey("evidence.id"), index=True)
    # comma-separated when multiple modules corroborate the same finding, e.g.
    # "log_anomaly, financial" — see routers/analysis.py::run_all
    module = Column(String(120), nullable=False)  # log_anomaly | chat_analysis | financial | media_verification | cross_case
    event_type = Column(String(60), default="")
    description = Column(Text, default="")
    event_time = Column(DateTime, index=True)
    risk_score = Column(Float, default=0.0)
    risk_level = Column(String(12), default="Low")  # High | Medium | Low
    confidence = Column(Float, default=1.0)  # 1.0 if 2+ modules corroborated it, else 0.7
    meta = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utcnow)

    case = relationship("Case", back_populates="flagged_events")


class CustodyLog(Base):
    __tablename__ = "chain_of_custody"
    id = Column(Integer, primary_key=True)
    case_id = Column(Integer, ForeignKey("cases.id"), index=True)
    evidence_id = Column(Integer, ForeignKey("evidence.id"), index=True, nullable=True)
    action = Column(String(120), nullable=False)
    detail = Column(Text, default="")
    user_id = Column(Integer, ForeignKey("users.id"))
    username = Column(String(64), default="")
    timestamp = Column(DateTime, default=utcnow)
    # set only on orchestrated multi-module runs (routers/analysis.py::run_all)
    modules_involved = Column(String(200), nullable=True)  # "anomaly, financial, ocr"
    entities_found = Column(Integer, nullable=True)
    cross_case_links = Column(Integer, nullable=True)


class ExtractedEntity(Base):
    __tablename__ = "extracted_entities"
    id = Column(Integer, primary_key=True)
    case_id = Column(Integer, ForeignKey("cases.id"), index=True)
    evidence_id = Column(Integer, ForeignKey("evidence.id"), index=True)
    entity_type = Column(String(30))   # phone | account | ip | email | upi
    entity_value = Column(String(200), index=True)


class CrossCaseLink(Base):
    __tablename__ = "cross_case_links"
    id = Column(Integer, primary_key=True)
    entity_type = Column(String(30))
    entity_value = Column(String(200))
    case_a = Column(Integer, ForeignKey("cases.id"))
    case_b = Column(Integer, ForeignKey("cases.id"))
    evidence_a = Column(Integer, ForeignKey("evidence.id"))
    evidence_b = Column(Integer, ForeignKey("evidence.id"))
    created_at = Column(DateTime, default=utcnow)


class Report(Base):
    __tablename__ = "reports"
    id = Column(Integer, primary_key=True)
    case_id = Column(Integer, ForeignKey("cases.id"), index=True)
    file_path = Column(String(500))
    generated_by = Column(Integer, ForeignKey("users.id"))
    generated_at = Column(DateTime, default=utcnow)


class Certificate(Base):
    """A Section 65B(4) certificate draft. IntelTrace auto-populates the
    system-verifiable facts (hashes, timestamps, custody log) and captures
    the signing officer's attestation (name, designation, place, drawn
    signature) — the legal certification itself is the officer's act, not
    the software's; this only produces the paperwork for it."""
    __tablename__ = "certificates"
    id = Column(Integer, primary_key=True)
    case_id = Column(Integer, ForeignKey("cases.id"), index=True)
    file_path = Column(String(500))
    officer_name = Column(String(120), nullable=False)
    officer_designation = Column(String(120), nullable=False)
    place = Column(String(120), default="")
    generated_by = Column(Integer, ForeignKey("users.id"))
    generated_at = Column(DateTime, default=utcnow)
