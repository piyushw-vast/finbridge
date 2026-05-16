import uuid
import enum
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Enum, Float, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class InvoiceType(str, enum.Enum):
    PURCHASE = "purchase"
    SALES = "sales"
    PAYMENT = "payment"
    SALARY_REGISTER = "salary_register"
    BANK_STATEMENT = "bank_statement"
    LEDGER = "ledger"


class TransactionStatus(str, enum.Enum):
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    NEEDS_CORRECTION = "needs_correction"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_type: Mapped[str] = mapped_column(String(50), nullable=False)  # image/pdf
    invoice_type: Mapped[InvoiceType] = mapped_column(Enum(InvoiceType, values_callable=lambda x: [e.value for e in x]), default=InvoiceType.PURCHASE)

    # Extraction results
    raw_ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    extraction_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # full consensus output
    trust_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence_scores: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # per-field confidence
    conflicts: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # detected conflicts

    # Status
    status: Mapped[TransactionStatus] = mapped_column(Enum(TransactionStatus, values_callable=lambda x: [e.value for e in x]), default=TransactionStatus.PENDING)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Duplicate detection
    embedding_id: Mapped[str | None] = mapped_column(String(255), nullable=True)  # pgvector reference
    duplicate_of: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=True)
    duplicate_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    company: Mapped["Company"] = relationship("Company", back_populates="invoices")
    transaction: Mapped["ExtractedTransaction"] = relationship("ExtractedTransaction", back_populates="invoice", uselist=False)


class ExtractedTransaction(Base):
    __tablename__ = "extracted_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"), unique=True, nullable=False)
    company_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False)

    vendor_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    vendor_gst: Mapped[str | None] = mapped_column(String(20), nullable=True)
    invoice_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    invoice_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    due_date: Mapped[str | None] = mapped_column(String(50), nullable=True)

    subtotal: Mapped[float | None] = mapped_column(Float, nullable=True)
    tax_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(10), default="INR")

    line_items: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    payment_head_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("payment_heads.id"), nullable=True)

    # Corrected values by accountant
    corrected_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_corrected: Mapped[bool] = mapped_column(default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="transaction")
