"""
Invoice processing orchestrator.
Runs all extractors in parallel, builds consensus, stores results.
"""
import asyncio
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models.invoice import Invoice, ExtractedTransaction, TransactionStatus
from app.models.user import User
from app.services.extraction.preprocessor import preprocess_image, pdf_to_images, image_to_base64
from app.services.extraction.claude_extractor import extract_with_claude, refine_low_confidence_field
from app.services.extraction.donut_extractor import extract_with_donut
from app.services.extraction.ocr_extractor import extract_with_ocr
from app.services.extraction.regex_validator import run_all_validations
from app.services.extraction.normalizer import normalize_extraction
from app.services.extraction.consensus import build_consensus
from app.services.extraction.bank_statement_extractor import extract_bank_statement
from app.utils.audit import create_audit_log
from app.utils.notifications import notify_accountants_new_invoice
from app.utils.auto_categorize import auto_assign_payment_head
from app.models.audit import AuditAction
from app.models.invoice import InvoiceType


# Processing status stages (stored in extraction_data.processing_status)
STAGES = [
    "queued",
    "preprocessing",
    "extracting",
    "validating",
    "scoring",
    "complete",
    "failed",
]


async def process_invoice(
    db: AsyncSession,
    invoice_id: uuid.UUID,
    image_bytes: bytes,
    file_type: str,
    uploaded_by_id: uuid.UUID,
) -> dict:
    """
    Full extraction pipeline. Called as a background task.
    Updates invoice status at each stage for frontend polling.
    """
    try:
        await _update_stage(db, invoice_id, "preprocessing", {"processing_status": "preprocessing"})

        # Branch: bank statements get a specialized parser
        invoice_row = await db.get(Invoice, invoice_id)
        if invoice_row and invoice_row.invoice_type == InvoiceType.BANK_STATEMENT:
            return await _process_bank_statement(db, invoice_id, image_bytes, file_type, uploaded_by_id)

        # Keep original bytes for PDF text extraction
        original_bytes = image_bytes
        is_pdf = file_type == "application/pdf" or file_type.endswith("pdf")

        # Handle PDF — convert first page to image for vision extractors
        if is_pdf:
            pages = pdf_to_images(image_bytes)
            if pages:
                image_bytes = pages[0]
                media_type = "image/jpeg"
            else:
                media_type = "application/pdf"
        else:
            media_type = file_type if file_type.startswith("image/") else "image/jpeg"

        # Preprocess image
        processed_bytes, quality_metrics = preprocess_image(image_bytes)
        image_quality = quality_metrics.get("quality_score", 0.5)

        await _update_stage(db, invoice_id, "extracting", {
            "processing_status": "extracting",
            "quality_metrics": quality_metrics,
        })

        # Run Gemini + PyMuPDF text extractor in parallel
        inv_type_str = invoice_row.invoice_type.value if invoice_row else None
        claude_task = extract_with_claude(processed_bytes, media_type, invoice_type=inv_type_str)
        donut_task = extract_with_donut(processed_bytes, pdf_bytes=original_bytes if is_pdf else None)

        claude_result, donut_result = await asyncio.gather(claude_task, donut_task)
        ocr_result = {"success": False, "data": {}, "error": "disabled", "raw_text": ""}

        claude_data = claude_result.get("data", {}) if claude_result["success"] else {}
        donut_data = donut_result.get("data", {}) if donut_result["success"] else {}
        ocr_data = {}
        raw_ocr_text = donut_result.get("raw", "")

        import logging
        log = logging.getLogger("invoice_debug")
        log.warning(f"[GEMINI] success={claude_result['success']} err={claude_result.get('error')} data={claude_data}")
        log.warning(f"[DONUT]  success={donut_result['success']} err={donut_result.get('error')} data={donut_data}")

        # Normalize all outputs
        claude_normalized = normalize_extraction(claude_data) if claude_data else {}
        donut_normalized = normalize_extraction(donut_data) if donut_data else {}
        ocr_normalized = {}

        await _update_stage(db, invoice_id, "validating", {"processing_status": "validating"})

        # Run validation on best available data (Claude preferred, fallback to donut/ocr)
        best_data = claude_normalized or donut_normalized or ocr_normalized
        validation_report = run_all_validations(best_data)

        # Build consensus
        consensus = build_consensus(
            claude_result=claude_normalized,
            donut_result=donut_normalized,
            ocr_result=ocr_normalized,
            validation_report=validation_report,
            image_quality=image_quality,
        )

        # Refine low-confidence critical fields
        low_conf_fields = {
            f: v for f, v in consensus["field_confidence"].items()
            if v["confidence"] < 0.6 and f in ["vendor_gst", "total_amount", "invoice_number"]
        }
        field_descriptions = {
            "vendor_gst": "15-character GST number (format: 2 digits, 5 letters, 4 digits, 1 letter, 1 alphanumeric, Z, 1 alphanumeric)",
            "total_amount": "final total amount payable (look for 'Total', 'Grand Total', 'Amount Due')",
            "invoice_number": "invoice or bill number (look for 'Invoice No', 'Bill No', 'Ref No')",
        }
        for field, conf_data in low_conf_fields.items():
            refinement = await refine_low_confidence_field(
                field=field,
                current_value=conf_data.get("value"),
                image_bytes=processed_bytes,
                media_type=media_type,
            )
            ref_conf = refinement.get("confidence", 0)
            ref_value = refinement.get("value")
            if ref_value is not None and ref_conf > conf_data["confidence"]:
                consensus["field_confidence"][field]["value"] = ref_value
                consensus["field_confidence"][field]["confidence"] = ref_conf
                consensus["field_confidence"][field]["refined"] = True
                consensus["final_data"][field] = ref_value

        await _update_stage(db, invoice_id, "scoring", {"processing_status": "scoring"})

        # Determine status
        trust_score = consensus["trust_score"]
        if trust_score >= 85:
            new_status = TransactionStatus.ACCEPTED
        elif trust_score >= 60:
            new_status = TransactionStatus.UNDER_REVIEW
        else:
            new_status = TransactionStatus.NEEDS_CORRECTION

        full_extraction = {
            "processing_status": "complete",
            "extractors": {
                "claude": {"success": claude_result["success"], "data": claude_normalized},
                "donut": {"success": donut_result["success"], "data": donut_normalized},
                "ocr": {"success": ocr_result["success"], "data": ocr_normalized},
            },
            "validation": validation_report,
            "quality_metrics": quality_metrics,
        }
        # Preserve payment-receipt-specific fields not in ExtractedTransaction columns
        best_raw = claude_result.get("data", {}) or donut_result.get("data", {})
        for field in ("utr_number", "bank_name"):
            if best_raw.get(field):
                full_extraction[field] = best_raw[field]

        # Save final results
        stmt = (
            update(Invoice)
            .where(Invoice.id == invoice_id)
            .values(
                status=new_status,
                raw_ocr_text=raw_ocr_text,
                extraction_data=full_extraction,
                trust_score=trust_score,
                confidence_scores={f: v["confidence"] for f, v in consensus["field_confidence"].items()},
                conflicts=consensus["conflicts"],
                updated_at=datetime.utcnow(),
            )
        )
        await db.execute(stmt)

        # Save extracted transaction
        final = consensus["final_data"]
        existing = await db.execute(
            select(ExtractedTransaction).where(ExtractedTransaction.invoice_id == invoice_id)
        )
        existing_tx = existing.scalar_one_or_none()

        invoice_row = await db.get(Invoice, invoice_id)

        # Check for duplicate invoice
        duplicate_invoice_id = await _check_duplicate(db, invoice_row.company_id, invoice_id, final)
        if duplicate_invoice_id:
            await db.execute(
                update(Invoice).where(Invoice.id == invoice_id)
                .values(duplicate_of=uuid.UUID(duplicate_invoice_id))
            )

        if not existing_tx:
            payment_head_id = await auto_assign_payment_head(
                db=db,
                company_id=invoice_row.company_id,
                vendor_name=final.get("vendor_name"),
                line_items=final.get("line_items"),
            )
            tx = ExtractedTransaction(
                invoice_id=invoice_id,
                company_id=invoice_row.company_id,
                vendor_name=final.get("vendor_name"),
                vendor_gst=final.get("vendor_gst"),
                invoice_number=final.get("invoice_number"),
                invoice_date=final.get("invoice_date"),
                due_date=final.get("due_date"),
                subtotal=final.get("subtotal"),
                tax_amount=final.get("tax_amount"),
                total_amount=final.get("total_amount"),
                currency=final.get("currency", "INR"),
                line_items=final.get("line_items"),
                payment_head_id=payment_head_id,
            )
            db.add(tx)

        await create_audit_log(
            db=db,
            action=AuditAction.INVOICE_EXTRACTED,
            entity_type="invoice",
            entity_id=str(invoice_id),
            user_id=uploaded_by_id,
            details={"trust_score": trust_score, "risk_level": consensus["risk_level"], "conflicts": len(consensus["conflicts"])},
        )

        await db.commit()

        # Notify accountants if review needed
        if new_status in [TransactionStatus.UNDER_REVIEW, TransactionStatus.NEEDS_CORRECTION]:
            await _notify_accountants(db, invoice_row, trust_score)

        return {
            "success": True,
            "trust_score": trust_score,
            "risk_level": consensus["risk_level"],
            "status": new_status.value,
            "conflicts": consensus["conflicts"],
            "field_confidence": consensus["field_confidence"],
        }

    except Exception as e:
        await _update_stage(db, invoice_id, "failed", {"processing_status": "failed", "error": str(e)})
        await db.commit()
        return {"success": False, "error": str(e)}


async def _process_bank_statement(
    db: AsyncSession,
    invoice_id: uuid.UUID,
    file_bytes: bytes,
    file_type: str,
    uploaded_by_id: uuid.UUID,
) -> dict:
    """Specialized pipeline for bank statements — extracts individual transaction rows."""
    try:
        await _update_stage(db, invoice_id, "extracting", {"processing_status": "extracting"})

        is_pdf = file_type == "application/pdf" or file_type.endswith("pdf")
        original_bytes = file_bytes

        if is_pdf:
            pages = pdf_to_images(file_bytes)
            if pages:
                image_bytes = pages[0]
                media_type = "image/jpeg"
            else:
                image_bytes = file_bytes
                media_type = "application/pdf"
        else:
            image_bytes = file_bytes
            media_type = file_type

        processed_bytes, _ = preprocess_image(image_bytes)

        result = await extract_bank_statement(
            image_bytes=processed_bytes,
            media_type=media_type,
            pdf_bytes=original_bytes if is_pdf else None,
        )

        await _update_stage(db, invoice_id, "scoring", {"processing_status": "scoring"})

        data = result.get("data", {})
        transactions = data.get("transactions", [])
        tx_count = len(transactions)

        # Trust score based on how many transactions were extracted
        trust_score = min(95.0, 60.0 + tx_count * 2) if tx_count > 0 else 30.0
        new_status = TransactionStatus.UNDER_REVIEW if tx_count > 0 else TransactionStatus.NEEDS_CORRECTION

        # Categorize each transaction
        categorized_transactions = []
        for txn in transactions:
            head_id = await auto_assign_payment_head(
                db=db,
                company_id=(await db.get(Invoice, invoice_id)).company_id,
                vendor_name=txn.get("description"),
                line_items=None,
            )
            categorized_transactions.append({**txn, "payment_head_id": str(head_id) if head_id else None})

        full_extraction = {
            "processing_status": "complete",
            "document_type": "bank_statement",
            "account_holder": data.get("account_holder"),
            "account_number": data.get("account_number"),
            "bank_name": data.get("bank_name"),
            "statement_period_start": data.get("statement_period_start"),
            "statement_period_end": data.get("statement_period_end"),
            "opening_balance": data.get("opening_balance"),
            "closing_balance": data.get("closing_balance"),
            "transaction_count": tx_count,
            "transactions": categorized_transactions,
        }

        invoice_row = await db.get(Invoice, invoice_id)

        stmt = (
            update(Invoice)
            .where(Invoice.id == invoice_id)
            .values(
                status=new_status,
                extraction_data=full_extraction,
                trust_score=trust_score,
                confidence_scores={"transaction_count": tx_count},
                conflicts=[],
                updated_at=datetime.utcnow(),
            )
        )
        await db.execute(stmt)

        # Store summary as ExtractedTransaction (totals)
        total_debits = sum(t.get("debit") or 0 for t in transactions)
        total_credits = sum(t.get("credit") or 0 for t in transactions)

        existing = await db.execute(
            select(ExtractedTransaction).where(ExtractedTransaction.invoice_id == invoice_id)
        )
        if not existing.scalar_one_or_none():
            tx = ExtractedTransaction(
                invoice_id=invoice_id,
                company_id=invoice_row.company_id,
                vendor_name=data.get("bank_name") or "Bank Statement",
                invoice_date=data.get("statement_period_end"),
                subtotal=total_credits,
                tax_amount=0,
                total_amount=total_debits,
                currency=data.get("currency", "INR"),
                line_items=categorized_transactions,
            )
            db.add(tx)

        await create_audit_log(
            db=db,
            action=AuditAction.INVOICE_EXTRACTED,
            entity_type="invoice",
            entity_id=str(invoice_id),
            user_id=uploaded_by_id,
            details={"document_type": "bank_statement", "transaction_count": tx_count, "trust_score": trust_score},
        )
        await db.commit()

        if new_status == TransactionStatus.UNDER_REVIEW:
            await _notify_accountants(db, invoice_row, trust_score)

        return {"success": True, "trust_score": trust_score, "transaction_count": tx_count}

    except Exception as e:
        await _update_stage(db, invoice_id, "failed", {"processing_status": "failed", "error": str(e)})
        await db.commit()
        return {"success": False, "error": str(e)}


async def _update_stage(db: AsyncSession, invoice_id: uuid.UUID, stage: str, extra: dict = None):
    data = {"processing_status": stage, **(extra or {})}
    stmt = (
        update(Invoice)
        .where(Invoice.id == invoice_id)
        .values(
            extraction_data=data,
            updated_at=datetime.utcnow(),
        )
    )
    await db.execute(stmt)
    await db.commit()


async def _notify_accountants(db: AsyncSession, invoice: Invoice, trust_score: float):
    from app.models.user import UserRole
    from app.models.company import Company

    # Load company explicitly to avoid lazy-load greenlet error
    company_result = await db.execute(select(Company).where(Company.id == invoice.company_id))
    company = company_result.scalar_one_or_none()
    if not company:
        return

    result = await db.execute(
        select(User).where(
            User.firm_id == company.firm_id,
            User.role == UserRole.ACCOUNTANT,
            User.is_active == True,
        )
    )
    accountants = result.scalars().all()
    accountant_ids = [a.id for a in accountants]

    if accountant_ids:
        await notify_accountants_new_invoice(
            db=db,
            accountant_ids=accountant_ids,
            invoice_id=invoice.id,
            company_name=company.name,
            trust_score=trust_score,
        )
        await db.commit()


async def _check_duplicate(db, company_id, current_invoice_id, final_data):
    """Check if invoice_number+vendor already exists for this company."""
    inv_number = final_data.get("invoice_number")
    vendor = final_data.get("vendor_name")
    if not inv_number or not vendor:
        return None

    result = await db.execute(
        select(ExtractedTransaction)
        .join(Invoice, Invoice.id == ExtractedTransaction.invoice_id)
        .where(
            Invoice.company_id == company_id,
            Invoice.id != current_invoice_id,
            ExtractedTransaction.invoice_number == inv_number,
            ExtractedTransaction.vendor_name == vendor,
        )
    )
    existing_tx = result.scalar_one_or_none()
    return str(existing_tx.invoice_id) if existing_tx else None
