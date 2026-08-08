from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str
    full_name: str


class UserCreate(BaseModel):
    username: str
    password: str = Field(min_length=8)
    full_name: str = ""
    role: str = "viewer"


class UserOut(ORM):
    id: int
    username: str
    full_name: str
    role: str
    created_at: datetime


class PasswordChange(BaseModel):
    new_password: str = Field(min_length=8)


class CaseCreate(BaseModel):
    name: str
    description: str = ""


class CaseOut(ORM):
    id: int
    case_number: str
    name: str
    description: str
    status: str
    created_at: datetime
    evidence_count: int = 0
    flagged_count: int = 0
    high_risk_count: int = 0


class EvidenceOut(ORM):
    id: int
    case_id: int
    machine_id: str
    file_name: str
    file_type: str
    file_size: int
    original_hash: str
    current_hash: Optional[str] = None
    integrity_status: str
    source_os: str
    parsed_summary: Any = None
    uploaded_at: datetime


class FlaggedEventOut(ORM):
    id: int
    case_id: int
    evidence_id: Optional[int]
    module: str
    event_type: str
    description: str
    event_time: Optional[datetime]
    risk_score: float
    risk_level: str
    confidence: float = 1.0
    meta: Any = None


class CustodyOut(ORM):
    id: int
    case_id: Optional[int]
    evidence_id: Optional[int]
    action: str
    detail: str
    username: str
    timestamp: datetime
    modules_involved: Optional[str] = None
    entities_found: Optional[int] = None
    cross_case_links: Optional[int] = None


class CrossCaseLinkOut(ORM):
    id: int
    entity_type: str
    entity_value: str
    case_a: int
    case_b: int
    case_a_number: Optional[str] = None
    case_b_number: Optional[str] = None
    created_at: datetime


class CertificateRequest(BaseModel):
    officer_name: str = Field(min_length=1)
    officer_designation: str = Field(min_length=1)
    place: str = ""
    signature_data_url: str = Field(min_length=1)


class TimelineItem(BaseModel):
    id: int
    timestamp: Optional[datetime]
    module: str
    event_type: str
    description: str
    evidence_id: Optional[int]
    risk_score: float
    risk_level: str
    related_to_previous: bool = False
