import uuid
import enum
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base


class ReportType(str, enum.Enum):
    MIS = "mis"
    BALANCE_SHEET = "balance_sheet"
    PROFIT_LOSS = "profit_loss"
    CASH_FLOW = "cash_flow"
    GST_SUMMARY = "gst_summary"
    OTHER = "other"


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    report_type: Mapped[ReportType] = mapped_column(Enum(ReportType, values_callable=lambda x: [e.value for e in x]), default=ReportType.MIS)
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    period_start: Mapped[str | None] = mapped_column(String(50), nullable=True)
    period_end: Mapped[str | None] = mapped_column(String(50), nullable=True)
    summary_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    company: Mapped["Company"] = relationship("Company", foreign_keys=[company_id])
    uploader: Mapped["User"] = relationship("User", foreign_keys=[uploaded_by])
