import uuid
import enum
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Enum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class AuditAction(str, enum.Enum):
    INVOICE_UPLOADED = "invoice_uploaded"
    INVOICE_EXTRACTED = "invoice_extracted"
    INVOICE_ACCEPTED = "invoice_accepted"
    INVOICE_REJECTED = "invoice_rejected"
    INVOICE_CORRECTION_SUBMITTED = "invoice_correction_submitted"
    REPORT_UPLOADED = "report_uploaded"
    USER_LOGIN = "user_login"
    USER_CREATED = "user_created"
    COMPANY_CREATED = "company_created"
    FIRM_CREATED = "firm_created"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action: Mapped[AuditAction] = mapped_column(Enum(AuditAction, values_callable=lambda x: [e.value for e in x]), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)  # invoice, report, company, etc.
    entity_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
