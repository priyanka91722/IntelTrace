from sqlalchemy.orm import Session
from .. import models


def log_action(db: Session, *, action: str, user: models.User | None = None,
               case_id: int | None = None, evidence_id: int | None = None,
               detail: str = "", modules_involved: list[str] | None = None,
               entities_found: int | None = None,
               cross_case_links: int | None = None) -> None:
    entry = models.CustodyLog(
        case_id=case_id, evidence_id=evidence_id, action=action, detail=detail,
        user_id=user.id if user else None,
        username=user.username if user else "system",
        modules_involved=", ".join(modules_involved) if modules_involved else None,
        entities_found=entities_found,
        cross_case_links=cross_case_links,
    )
    db.add(entry)
    db.commit()
