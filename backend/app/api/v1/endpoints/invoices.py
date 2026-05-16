import uuid
import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func
from typing import Optional, List

from app.core.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.invoice import Invoice, ExtractedTransaction, TransactionStatus, InvoiceType
from app.models.company import Company
from app.services.invoice_service import process_invoice
from app.utils.audit import create_audit_log
from app.utils.notifications import notify_company_invoice_status
from app.models.audit import AuditAction, AuditLog
from app.core.config import settings

router = APIRouter()

ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp",
    "image/tiff", "application/pdf"
}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


@router.post("/upload")
async def upload_invoice(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    invoice_type: InvoiceType = Form(InvoiceType.PURCHASE),
    company_id: uuid.UUID = Form(...),
    reupload_of: Optional[uuid.UUID] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER, UserRole.FIRM_ADMIN
    )),
):
    # Validate file type
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"File type {content_type} not supported. Upload image or PDF.")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 20MB.")

    # Verify company access
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if current_user.role in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]:
        if current_user.company_id != company_id:
            raise HTTPException(status_code=403, detail="Access denied")

    # Upload to Supabase Storage
    file_url = await _upload_to_storage(file_bytes, file.filename, content_type)

    # Create invoice record
    extraction_data: dict = {"processing_status": "queued"}
    if reupload_of:
        extraction_data["reupload_of"] = str(reupload_of)

    invoice = Invoice(
        company_id=company_id,
        uploaded_by=current_user.id,
        file_name=file.filename,
        file_url=file_url,
        file_type=content_type,
        invoice_type=invoice_type,
        status=TransactionStatus.PENDING,
        extraction_data=extraction_data,
    )
    db.add(invoice)
    await db.flush()
    invoice_id = invoice.id

    await create_audit_log(
        db=db,
        action=AuditAction.INVOICE_UPLOADED,
        entity_type="invoice",
        entity_id=str(invoice_id),
        user_id=current_user.id,
        details={"file_name": file.filename, "invoice_type": invoice_type.value},
    )
    await db.commit()

    # Process in background
    background_tasks.add_task(
        _run_extraction,
        invoice_id=invoice_id,
        file_bytes=file_bytes,
        file_type=content_type,
        uploaded_by_id=current_user.id,
    )

    return {
        "invoice_id": str(invoice_id),
        "status": "queued",
        "message": "Invoice uploaded. Extraction starting...",
        "reupload_of": str(reupload_of) if reupload_of else None,
    }


@router.post("/bulk-upload")
async def bulk_upload_invoices(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    invoice_type: InvoiceType = Form(InvoiceType.PURCHASE),
    company_id: uuid.UUID = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER, UserRole.FIRM_ADMIN
    )),
):
    if not files or len(files) == 0:
        raise HTTPException(status_code=400, detail="No files provided")
    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 files per bulk upload")

    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    if current_user.role in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]:
        if current_user.company_id != company_id:
            raise HTTPException(status_code=403, detail="Access denied")

    results = []
    for file in files:
        content_type = file.content_type or "application/octet-stream"
        if content_type not in ALLOWED_MIME_TYPES:
            results.append({"file_name": file.filename, "status": "error", "error": f"Unsupported type: {content_type}"})
            continue

        file_bytes = await file.read()
        if len(file_bytes) > MAX_FILE_SIZE:
            results.append({"file_name": file.filename, "status": "error", "error": "File too large (max 20MB)"})
            continue

        file_url = await _upload_to_storage(file_bytes, file.filename, content_type)

        invoice = Invoice(
            company_id=company_id,
            uploaded_by=current_user.id,
            file_name=file.filename,
            file_url=file_url,
            file_type=content_type,
            invoice_type=invoice_type,
            status=TransactionStatus.PENDING,
            extraction_data={"processing_status": "queued"},
        )
        db.add(invoice)
        await db.flush()

        await create_audit_log(
            db=db,
            action=AuditAction.INVOICE_UPLOADED,
            entity_type="invoice",
            entity_id=str(invoice.id),
            user_id=current_user.id,
            details={"file_name": file.filename, "invoice_type": invoice_type.value},
        )

        background_tasks.add_task(
            _run_extraction,
            invoice_id=invoice.id,
            file_bytes=file_bytes,
            file_type=content_type,
            uploaded_by_id=current_user.id,
        )

        results.append({"invoice_id": str(invoice.id), "file_name": file.filename, "status": "queued"})

    await db.commit()
    return {"uploaded": len([r for r in results if r.get("status") == "queued"]), "results": results}


async def _run_extraction(invoice_id: uuid.UUID, file_bytes: bytes, file_type: str, uploaded_by_id: uuid.UUID):
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        await process_invoice(db, invoice_id, file_bytes, file_type, uploaded_by_id)


async def _upload_to_storage(file_bytes: bytes, filename: str, content_type: str) -> str:
    try:
        from supabase import create_client
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        path = f"invoices/{uuid.uuid4()}/{filename}"
        supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).upload(
            path, file_bytes, {"content-type": content_type}
        )
        result = supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).get_public_url(path)
        return result
    except Exception:
        raise  # Supabase bucket required — create it in the Supabase dashboard


@router.get("")
async def list_invoices(
    company_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    paginate: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Invoice)

    if current_user.role in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]:
        query = query.where(Invoice.company_id == current_user.company_id)
    elif current_user.role == UserRole.ACCOUNTANT:
        # Accountants see invoices from companies in their firm
        from app.models.company import Company
        companies_q = select(Company.id).where(Company.firm_id == current_user.firm_id)
        query = query.where(Invoice.company_id.in_(companies_q))
        if not status:
            # Default: show pending review items
            query = query.where(Invoice.status.in_([
                TransactionStatus.UNDER_REVIEW,
                TransactionStatus.NEEDS_CORRECTION,
            ]))
    elif current_user.role == UserRole.FIRM_ADMIN:
        from app.models.company import Company
        companies_q = select(Company.id).where(Company.firm_id == current_user.firm_id)
        query = query.where(Invoice.company_id.in_(companies_q))

    if company_id:
        query = query.where(Invoice.company_id == company_id)
    if status:
        try:
            query = query.where(Invoice.status == TransactionStatus(status))
        except ValueError:
            pass

    # Accountants: risk-first (high risk at top), then latest. Everyone else: latest first.
    if current_user.role == UserRole.ACCOUNTANT:
        base_query = query.order_by(Invoice.trust_score.asc().nullsfirst(), Invoice.created_at.desc())
    else:
        base_query = query.order_by(Invoice.created_at.desc())

    if paginate:
        count_query = select(func.count()).select_from(base_query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

    tx_query = select(Invoice, ExtractedTransaction).join(
        ExtractedTransaction, ExtractedTransaction.invoice_id == Invoice.id, isouter=True
    )
    if current_user.role in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]:
        tx_query = tx_query.where(Invoice.company_id == current_user.company_id)
    elif current_user.role == UserRole.ACCOUNTANT:
        from app.models.company import Company as _C2
        cq2 = select(_C2.id).where(_C2.firm_id == current_user.firm_id)
        tx_query = tx_query.where(Invoice.company_id.in_(cq2))
        if not status:
            tx_query = tx_query.where(Invoice.status.in_([TransactionStatus.UNDER_REVIEW, TransactionStatus.NEEDS_CORRECTION]))
    elif current_user.role == UserRole.FIRM_ADMIN:
        from app.models.company import Company as _C3
        cq3 = select(_C3.id).where(_C3.firm_id == current_user.firm_id)
        tx_query = tx_query.where(Invoice.company_id.in_(cq3))
    if company_id:
        tx_query = tx_query.where(Invoice.company_id == company_id)
    if status:
        try:
            tx_query = tx_query.where(Invoice.status == TransactionStatus(status))
        except ValueError:
            pass
    if current_user.role == UserRole.ACCOUNTANT:
        tx_query = tx_query.order_by(Invoice.trust_score.asc().nullsfirst(), Invoice.created_at.desc())
    else:
        tx_query = tx_query.order_by(Invoice.created_at.desc())
    tx_query = tx_query.offset(skip).limit(limit)

    rows_result = await db.execute(tx_query)
    rows = rows_result.all()

    if paginate:
        return {
            "items": [_invoice_to_dict(inv, tx) for inv, tx in rows],
            "total": total,
            "skip": skip,
            "limit": limit,
        }
    return [_invoice_to_dict(inv, tx) for inv, tx in rows]


@router.get("/stats/summary")
async def get_stats(
    company_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_q = select(Invoice)

    if current_user.role in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]:
        base_q = base_q.where(Invoice.company_id == current_user.company_id)
    elif current_user.role in [UserRole.ACCOUNTANT, UserRole.FIRM_ADMIN]:
        from app.models.company import Company
        companies_q = select(Company.id).where(Company.firm_id == current_user.firm_id)
        base_q = base_q.where(Invoice.company_id.in_(companies_q))

    if company_id:
        base_q = base_q.where(Invoice.company_id == company_id)

    result = await db.execute(base_q)
    invoices = result.scalars().all()

    invoice_ids = [i.id for i in invoices if i.status == TransactionStatus.ACCEPTED]
    total_spend = 0.0
    if invoice_ids:
        tx_result = await db.execute(
            select(func.sum(ExtractedTransaction.total_amount))
            .where(ExtractedTransaction.invoice_id.in_(invoice_ids))
        )
        total_spend = tx_result.scalar() or 0.0

    return {
        "total": len(invoices),
        "pending": sum(1 for i in invoices if i.status == TransactionStatus.PENDING),
        "under_review": sum(1 for i in invoices if i.status == TransactionStatus.UNDER_REVIEW),
        "needs_correction": sum(1 for i in invoices if i.status == TransactionStatus.NEEDS_CORRECTION),
        "accepted": sum(1 for i in invoices if i.status == TransactionStatus.ACCEPTED),
        "rejected": sum(1 for i in invoices if i.status == TransactionStatus.REJECTED),
        "avg_trust_score": round(
            sum(i.trust_score for i in invoices if i.trust_score) / max(1, sum(1 for i in invoices if i.trust_score)), 1
        ),
        "high_risk": sum(1 for i in invoices if i.trust_score and i.trust_score < 60),
        "total_spend": round(total_spend, 2),
    }


@router.get("/insights/spend")
async def get_spend_insights(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_q = select(Invoice, ExtractedTransaction).join(
        ExtractedTransaction, ExtractedTransaction.invoice_id == Invoice.id, isouter=True
    ).where(Invoice.status == TransactionStatus.ACCEPTED)

    if current_user.role in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]:
        base_q = base_q.where(Invoice.company_id == current_user.company_id)
    elif current_user.role in [UserRole.ACCOUNTANT, UserRole.FIRM_ADMIN]:
        from app.models.company import Company
        companies_q = select(Company.id).where(Company.firm_id == current_user.firm_id)
        base_q = base_q.where(Invoice.company_id.in_(companies_q))

    result = await db.execute(base_q)
    rows = result.all()

    monthly: dict[str, float] = {}
    categories: dict[str, float] = {}

    for invoice, tx in rows:
        amount = tx.total_amount if tx and tx.total_amount else 0
        if not amount:
            continue
        month_key = invoice.created_at.strftime("%b %Y")
        monthly[month_key] = monthly.get(month_key, 0) + amount
        cat = invoice.invoice_type.value.replace("_", " ").title()
        categories[cat] = categories.get(cat, 0) + amount

    from datetime import datetime as dt
    sorted_monthly = sorted(monthly.items(), key=lambda x: dt.strptime(x[0], "%b %Y"))

    return {
        "monthly_spend": [{"month": k, "amount": round(v, 2)} for k, v in sorted_monthly[-6:]],
        "by_category": [{"category": k, "amount": round(v, 2)} for k, v in sorted(categories.items(), key=lambda x: -x[1])],
        "total_spend": round(sum(monthly.values()), 2),
        "total_accepted": len(rows),
    }


@router.get("/export/csv")
async def export_invoices_csv(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi.responses import StreamingResponse
    import csv, io

    query = select(Invoice, ExtractedTransaction).join(
        ExtractedTransaction, ExtractedTransaction.invoice_id == Invoice.id, isouter=True
    )
    if current_user.role in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]:
        query = query.where(Invoice.company_id == current_user.company_id)
    elif current_user.role in [UserRole.ACCOUNTANT, UserRole.FIRM_ADMIN]:
        from app.models.company import Company
        companies_q = select(Company.id).where(Company.firm_id == current_user.firm_id)
        query = query.where(Invoice.company_id.in_(companies_q))
    query = query.order_by(Invoice.created_at.desc())

    result = await db.execute(query)
    rows = result.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Invoice ID", "File Name", "Type", "Status", "Vendor", "Invoice Number",
                     "Invoice Date", "Subtotal", "Tax", "Total", "Currency", "Trust Score", "Uploaded At"])

    for inv, tx in rows:
        writer.writerow([
            str(inv.id), inv.file_name, inv.invoice_type.value, inv.status.value,
            tx.vendor_name if tx else "", tx.invoice_number if tx else "",
            tx.invoice_date if tx else "", tx.subtotal if tx else "",
            tx.tax_amount if tx else "", tx.total_amount if tx else "",
            tx.currency if tx else "INR", inv.trust_score or "",
            inv.created_at.strftime("%Y-%m-%d %H:%M"),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=invoices_export.csv"}
    )


@router.get("/insights/confidence-trend")
async def get_confidence_trend(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ACCOUNTANT, UserRole.FIRM_ADMIN)),
):
    from app.models.company import Company
    from datetime import timedelta

    companies_q = select(Company.id).where(Company.firm_id == current_user.firm_id)
    cutoff = datetime.utcnow() - timedelta(days=30)

    result = await db.execute(
        select(Invoice).where(
            Invoice.company_id.in_(companies_q),
            Invoice.trust_score.isnot(None),
            Invoice.created_at >= cutoff,
        ).order_by(Invoice.created_at.asc())
    )
    invoices = result.scalars().all()

    from collections import defaultdict
    daily: dict = defaultdict(list)
    for inv in invoices:
        day = inv.created_at.strftime("%d %b")
        daily[day].append(inv.trust_score)

    trend = [
        {"date": day, "avg_trust": round(sum(scores) / len(scores), 1), "count": len(scores)}
        for day, scores in daily.items()
    ]

    all_scores = [inv.trust_score for inv in invoices]
    auto_accepted = sum(1 for inv in invoices if inv.trust_score and inv.trust_score >= 85)

    return {
        "trend": trend,
        "avg_trust_score": round(sum(all_scores) / len(all_scores), 1) if all_scores else 0,
        "auto_accepted_rate": round(auto_accepted / len(invoices) * 100, 1) if invoices else 0,
        "total_processed": len(invoices),
    }


@router.get("/{invoice_id}/comments")
async def get_comments(invoice_id: uuid.UUID, db=Depends(get_db), current_user=Depends(get_current_user)):
    from app.models.comment import InvoiceComment
    from app.models.user import User as UserModel
    result = await db.execute(
        select(InvoiceComment, UserModel)
        .join(UserModel, UserModel.id == InvoiceComment.user_id)
        .where(InvoiceComment.invoice_id == invoice_id)
        .order_by(InvoiceComment.created_at.asc())
    )
    rows = result.all()
    return [
        {
            "id": str(c.id),
            "message": c.message,
            "user_name": u.full_name,
            "user_role": u.role.value,
            "created_at": c.created_at.isoformat(),
        }
        for c, u in rows
    ]


@router.post("/{invoice_id}/comments", status_code=201)
async def add_comment(invoice_id: uuid.UUID, payload: dict, db=Depends(get_db), current_user=Depends(get_current_user)):
    from app.models.comment import InvoiceComment
    msg = payload.get("message", "").strip()
    if not msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    comment = InvoiceComment(invoice_id=invoice_id, user_id=current_user.id, message=msg)
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return {"id": str(comment.id), "message": comment.message, "user_name": current_user.full_name, "user_role": current_user.role.value, "created_at": comment.created_at.isoformat()}



@router.get("/{invoice_id}/download")
async def download_invoice_file(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi.responses import RedirectResponse
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    _check_invoice_access(invoice, current_user)
    if not invoice.file_url:
        raise HTTPException(status_code=404, detail="No file attached")
    # Public Supabase bucket — redirect directly to the public URL
    return RedirectResponse(url=invoice.file_url)

@router.delete("/{invoice_id}", status_code=204)
async def delete_invoice(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER, UserRole.FIRM_ADMIN)),
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if current_user.role in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]:
        if invoice.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Access denied")
    if invoice.status == TransactionStatus.ACCEPTED:
        raise HTTPException(status_code=400, detail="Cannot delete an accepted invoice")
    await db.delete(invoice)
    await db.commit()


@router.get("/insights/vendor/{vendor_name}")
async def get_vendor_intelligence(
    vendor_name: str,
    company_id: uuid.UUID,
    amount: Optional[float] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Total invoice count for this vendor in the company
    count_result = await db.execute(
        select(func.count(Invoice.id))
        .join(ExtractedTransaction, ExtractedTransaction.invoice_id == Invoice.id)
        .where(
            Invoice.company_id == company_id,
            ExtractedTransaction.vendor_name.ilike(vendor_name),
        )
    )
    invoice_count = count_result.scalar() or 0

    # Average total_amount across accepted invoices
    avg_result = await db.execute(
        select(func.avg(ExtractedTransaction.total_amount))
        .join(Invoice, Invoice.id == ExtractedTransaction.invoice_id)
        .where(
            Invoice.company_id == company_id,
            Invoice.status == TransactionStatus.ACCEPTED,
            ExtractedTransaction.vendor_name.ilike(vendor_name),
        )
    )
    avg_amount = avg_result.scalar()
    avg_amount = round(float(avg_amount), 2) if avg_amount is not None else None

    # Most recent invoice date
    last_seen_result = await db.execute(
        select(func.max(Invoice.created_at))
        .join(ExtractedTransaction, ExtractedTransaction.invoice_id == Invoice.id)
        .where(
            Invoice.company_id == company_id,
            ExtractedTransaction.vendor_name.ilike(vendor_name),
        )
    )
    last_seen = last_seen_result.scalar()

    # Last 5 total_amounts for sparkline
    amounts_result = await db.execute(
        select(ExtractedTransaction.total_amount)
        .join(Invoice, Invoice.id == ExtractedTransaction.invoice_id)
        .where(
            Invoice.company_id == company_id,
            ExtractedTransaction.vendor_name.ilike(vendor_name),
            ExtractedTransaction.total_amount.isnot(None),
        )
        .order_by(Invoice.created_at.desc())
        .limit(5)
    )
    amounts = [row[0] for row in amounts_result.all()]

    current_vs_avg = None
    if amount is not None and avg_amount:
        current_vs_avg = round(amount / avg_amount, 4)

    return {
        "vendor_name": vendor_name,
        "company_id": str(company_id),
        "invoice_count": invoice_count,
        "avg_amount": avg_amount,
        "last_seen": last_seen.isoformat() if last_seen else None,
        "amounts": amounts,
        "current_vs_avg": current_vs_avg,
    }


@router.post("/bulk-accept")
async def bulk_accept_invoices(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ACCOUNTANT, UserRole.FIRM_ADMIN)),
):
    invoice_ids: List[str] = payload.get("invoice_ids", [])
    notes: Optional[str] = payload.get("notes")

    if not invoice_ids:
        raise HTTPException(status_code=400, detail="invoice_ids is required and must not be empty")

    accepted = 0
    skipped = 0

    for raw_id in invoice_ids:
        try:
            inv_uuid = uuid.UUID(raw_id)
        except (ValueError, AttributeError):
            skipped += 1
            continue

        invoice = await db.get(Invoice, inv_uuid)
        if not invoice or invoice.status == TransactionStatus.ACCEPTED:
            skipped += 1
            continue

        invoice.status = TransactionStatus.ACCEPTED
        invoice.reviewed_by = current_user.id
        invoice.reviewer_notes = notes
        invoice.reviewed_at = datetime.utcnow()
        invoice.updated_at = datetime.utcnow()

        await create_audit_log(
            db=db,
            action=AuditAction.INVOICE_ACCEPTED,
            entity_type="invoice",
            entity_id=str(inv_uuid),
            user_id=current_user.id,
            details={"notes": notes, "bulk": True},
        )

        await _notify_company_users(db, invoice, "accepted", current_user.full_name)
        accepted += 1

    await db.commit()
    return {"accepted": accepted, "skipped": skipped}


@router.post("/chat")
async def chat_with_invoices(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import re as _re
    from groq import Groq

    question = payload.get("question", "")
    company_id = payload.get("company_id")

    query = select(Invoice, ExtractedTransaction).join(
        ExtractedTransaction, ExtractedTransaction.invoice_id == Invoice.id, isouter=True
    )

    if current_user.role in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]:
        query = query.where(Invoice.company_id == current_user.company_id)
    elif current_user.role in [UserRole.ACCOUNTANT, UserRole.FIRM_ADMIN]:
        from app.models.company import Company as _Company
        companies_q = select(_Company.id).where(_Company.firm_id == current_user.firm_id)
        query = query.where(Invoice.company_id.in_(companies_q))

    if company_id:
        try:
            cid = uuid.UUID(str(company_id))
            query = query.where(Invoice.company_id == cid)
        except (ValueError, AttributeError):
            pass

    query = query.order_by(Invoice.created_at.desc()).limit(100)
    result = await db.execute(query)
    rows = result.all()

    lines = []
    total_accepted = 0.0
    pending_count = 0
    high_risk_count = 0

    for inv, tx in rows:
        vendor = (tx.vendor_name if tx and tx.vendor_name else "Unknown Vendor")
        amount = (tx.total_amount if tx and tx.total_amount else 0)
        date_str = (tx.invoice_date[:10] if tx and tx.invoice_date else inv.created_at.strftime("%Y-%m-%d"))
        inv_type = inv.invoice_type.value.replace("_", " ").title()
        lines.append(f"- {vendor} | ₹{int(amount):,} | {date_str} | {inv.status.value} | {inv_type}")
        if inv.status == TransactionStatus.ACCEPTED:
            total_accepted += amount
        if inv.status == TransactionStatus.PENDING:
            pending_count += 1
        if inv.trust_score and inv.trust_score < 60:
            high_risk_count += 1

    context = "Invoice data summary (last 100 invoices):\n" + "\n".join(lines)
    context += f"\n\nTotal accepted: ₹{int(total_accepted):,} | Pending: {pending_count} invoices | High risk: {high_risk_count}"

    system_msg = (
        "You are a smart financial assistant for an Indian business using FinBridge. "
        "Answer questions about their invoice data concisely and helpfully. "
        "Use ₹ for currency. Be specific with numbers."
    )
    user_msg = f"Invoice context:\n{context}\n\nQuestion: {question}"

    client = Groq(api_key=settings.GROQ_API_KEY)
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg},
        ],
        max_tokens=400,
    )
    return {"answer": response.choices[0].message.content, "invoice_count": len(rows)}


@router.get("/fraud-signals")
async def get_fraud_signals(
    company_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    import re
    from datetime import date
    from collections import defaultdict

    query = select(Invoice, ExtractedTransaction).join(
        ExtractedTransaction, ExtractedTransaction.invoice_id == Invoice.id, isouter=True
    ).where(Invoice.status != TransactionStatus.REJECTED)

    if current_user.role in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]:
        query = query.where(Invoice.company_id == current_user.company_id)
    elif current_user.role in [UserRole.ACCOUNTANT, UserRole.FIRM_ADMIN]:
        from app.models.company import Company as _Company
        companies_q = select(_Company.id).where(_Company.firm_id == current_user.firm_id)
        query = query.where(Invoice.company_id.in_(companies_q))

    if company_id:
        query = query.where(Invoice.company_id == company_id)

    result = await db.execute(query)
    rows = result.all()

    # Build lookup maps for duplicate detection and vendor amount averages
    invoice_numbers: dict = defaultdict(list)
    vendor_amounts: dict = defaultdict(list)
    for inv, tx in rows:
        if tx:
            key = f"{(tx.vendor_name or '').lower()}|{(tx.invoice_number or '').lower()}"
            if tx.vendor_name and tx.invoice_number:
                invoice_numbers[key].append(str(inv.id))
            if tx.vendor_name and tx.total_amount:
                vendor_amounts[tx.vendor_name.lower()].append(tx.total_amount)

    GST_PATTERN = re.compile(r'^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$')
    signals = []
    today = date.today()

    for inv, tx in rows:
        if not tx:
            continue

        # 1. Invalid GST format
        if tx.vendor_gst and not GST_PATTERN.match(tx.vendor_gst.upper().strip()):
            signals.append({
                "invoice_id": str(inv.id),
                "file_name": inv.file_name,
                "signal": "invalid_gst",
                "severity": "high",
                "detail": f"GST '{tx.vendor_gst}' has invalid format",
            })

        # 2. Round number amount — catches ₹1,000 / ₹5,000 / ₹50,000 etc.
        if tx.total_amount and tx.total_amount >= 1000 and tx.total_amount % 1000 == 0:
            signals.append({
                "invoice_id": str(inv.id),
                "file_name": inv.file_name,
                "signal": "round_amount",
                "severity": "medium",
                "detail": f"Amount ₹{int(tx.total_amount):,} is an unusually round number — atypical for genuine invoices",
            })

        # 3. Future/stale/weekend date
        if tx.invoice_date:
            try:
                inv_date = datetime.strptime(tx.invoice_date[:10], "%Y-%m-%d").date()
                if inv_date > today:
                    signals.append({
                        "invoice_id": str(inv.id),
                        "file_name": inv.file_name,
                        "signal": "future_date",
                        "severity": "high",
                        "detail": f"Invoice date {tx.invoice_date} is in the future",
                    })
                elif (today - inv_date).days > 365:
                    signals.append({
                        "invoice_id": str(inv.id),
                        "file_name": inv.file_name,
                        "signal": "stale_invoice",
                        "severity": "medium",
                        "detail": f"Invoice is over 1 year old ({tx.invoice_date})",
                    })
                if inv_date.weekday() >= 5:
                    day_name = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][inv_date.weekday()]
                    signals.append({
                        "invoice_id": str(inv.id),
                        "file_name": inv.file_name,
                        "signal": "weekend_date",
                        "severity": "low",
                        "detail": f"Invoice dated on a {day_name}",
                    })
            except Exception:
                pass

        # 4. Duplicate invoice number
        if tx.vendor_name and tx.invoice_number:
            key = f"{tx.vendor_name.lower()}|{tx.invoice_number.lower()}"
            if len(invoice_numbers.get(key, [])) > 1:
                signals.append({
                    "invoice_id": str(inv.id),
                    "file_name": inv.file_name,
                    "signal": "duplicate_invoice_number",
                    "severity": "high",
                    "detail": f"Invoice number '{tx.invoice_number}' appears multiple times for vendor '{tx.vendor_name}'",
                })

        # 5. Amount anomaly vs vendor average (>2x deviation)
        if tx.vendor_name and tx.total_amount:
            amounts = vendor_amounts.get(tx.vendor_name.lower(), [])
            if len(amounts) >= 2:
                avg = sum(amounts) / len(amounts)
                if avg > 0 and tx.total_amount > avg * 2:
                    ratio = tx.total_amount / avg
                    signals.append({
                        "invoice_id": str(inv.id),
                        "file_name": inv.file_name,
                        "signal": "amount_anomaly",
                        "severity": "high",
                        "detail": f"₹{int(tx.total_amount):,} is {ratio:.1f}× above vendor average ₹{int(avg):,} — deviates from historical pattern",
                    })

        # 7. Low extraction confidence
        if inv.trust_score is not None and inv.trust_score < 55 and inv.status not in [TransactionStatus.REJECTED]:
            signals.append({
                "invoice_id": str(inv.id),
                "file_name": inv.file_name,
                "signal": "amount_anomaly",
                "severity": "medium",
                "detail": f"Low pipeline confidence (trust score {inv.trust_score}/100) — extraction engines could not reach reliable consensus",
            })

        # 6. Tax math inconsistency — subtotal + tax should equal total within 1%
        if tx.subtotal and tx.tax_amount and tx.total_amount:
            computed = float(tx.subtotal) + float(tx.tax_amount)
            actual = float(tx.total_amount)
            if actual > 0 and abs(computed - actual) / actual > 0.01:
                signals.append({
                    "invoice_id": str(inv.id),
                    "file_name": inv.file_name,
                    "signal": "amount_anomaly",
                    "severity": "high",
                    "detail": f"Tax structure inconsistency — subtotal ₹{int(tx.subtotal):,} + tax ₹{int(tx.tax_amount):,} ≠ total ₹{int(tx.total_amount):,}",
                })

    return {
        "signals": signals,
        "summary": {
            "high": len([s for s in signals if s["severity"] == "high"]),
            "medium": len([s for s in signals if s["severity"] == "medium"]),
            "low": len([s for s in signals if s["severity"] == "low"]),
            "total": len(signals),
            "affected_invoices": len(set(s["invoice_id"] for s in signals)),
        },
    }


@router.get("/gst-summary")
async def get_gst_summary(
    company_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from collections import defaultdict

    query = select(Invoice, ExtractedTransaction).join(
        ExtractedTransaction, ExtractedTransaction.invoice_id == Invoice.id, isouter=True
    ).where(Invoice.status == TransactionStatus.ACCEPTED)

    if current_user.role in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]:
        query = query.where(Invoice.company_id == current_user.company_id)
    elif current_user.role in [UserRole.ACCOUNTANT, UserRole.FIRM_ADMIN]:
        from app.models.company import Company as _Company
        companies_q = select(_Company.id).where(_Company.firm_id == current_user.firm_id)
        query = query.where(Invoice.company_id.in_(companies_q))

    if company_id:
        query = query.where(Invoice.company_id == company_id)

    result = await db.execute(query)
    rows = result.all()

    # Batch-load all companies to avoid N+1 queries
    from app.models.company import Company as _CompanyGST
    company_ids = list({inv.company_id for inv, tx in rows})
    companies_result = await db.execute(
        select(_CompanyGST).where(_CompanyGST.id.in_(company_ids))
    )
    company_map = {c.id: c for c in companies_result.scalars().all()}

    monthly: dict = defaultdict(lambda: {"cgst": 0.0, "sgst": 0.0, "igst": 0.0, "total": 0.0, "count": 0, "invoice_total": 0.0})
    vendors: dict = defaultdict(lambda: {"cgst": 0.0, "sgst": 0.0, "igst": 0.0, "total": 0.0, "count": 0})
    total_cgst = total_sgst = total_igst = 0.0

    for inv, tx in rows:
        if not tx:
            continue
        _co = company_map.get(inv.company_id)
        _split = _compute_gst_split(tx.tax_amount, tx.vendor_gst, _co.gst_number if _co else None)
        cgst = _split["cgst"] or 0.0
        sgst = _split["sgst"] or 0.0
        igst = _split["igst"] or 0.0
        inv_total = float(tx.total_amount or 0)

        ts = inv.created_at or datetime.utcnow()
        month = ts.strftime("%Y-%m")
        month_label = ts.strftime("%b %Y")

        monthly[month]["cgst"] += cgst
        monthly[month]["sgst"] += sgst
        monthly[month]["igst"] += igst
        monthly[month]["total"] += cgst + sgst + igst
        monthly[month]["count"] += 1
        monthly[month]["invoice_total"] += inv_total
        monthly[month]["label"] = month_label

        if tx.vendor_name:
            vendors[tx.vendor_name]["cgst"] += cgst
            vendors[tx.vendor_name]["sgst"] += sgst
            vendors[tx.vendor_name]["igst"] += igst
            vendors[tx.vendor_name]["total"] += cgst + sgst + igst
            vendors[tx.vendor_name]["count"] += 1

        total_cgst += cgst
        total_sgst += sgst
        total_igst += igst

    monthly_sorted = [
        {"month": k, **{k2: round(v2, 2) if isinstance(v2, (int, float)) else v2 for k2, v2 in v.items()}}
        for k, v in sorted(monthly.items())
    ]
    vendors_sorted = sorted(
        [{"vendor": k, **{k2: round(v2, 2) for k2, v2 in v.items()}} for k, v in vendors.items()],
        key=lambda x: -x["total"]
    )[:15]

    return {
        "total_cgst": round(total_cgst, 2),
        "total_sgst": round(total_sgst, 2),
        "total_igst": round(total_igst, 2),
        "total_input_credit": round(total_cgst + total_sgst + total_igst, 2),
        "invoice_count": len(rows),
        "monthly": monthly_sorted,
        "by_vendor": vendors_sorted,
    }


@router.get("/aging")
async def get_payment_aging(
    company_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from datetime import date, timedelta

    query = select(Invoice, ExtractedTransaction).join(
        ExtractedTransaction, ExtractedTransaction.invoice_id == Invoice.id, isouter=True
    ).where(Invoice.status == TransactionStatus.ACCEPTED)

    if current_user.role in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]:
        query = query.where(Invoice.company_id == current_user.company_id)
    elif current_user.role in [UserRole.ACCOUNTANT, UserRole.FIRM_ADMIN]:
        from app.models.company import Company as _Company
        companies_q = select(_Company.id).where(_Company.firm_id == current_user.firm_id)
        query = query.where(Invoice.company_id.in_(companies_q))

    if company_id:
        query = query.where(Invoice.company_id == company_id)

    result = await db.execute(query)
    rows = result.all()

    today = date.today()
    buckets: dict = {
        "not_due": {"invoices": [], "total_amount": 0.0},
        "overdue_30": {"invoices": [], "total_amount": 0.0},
        "overdue_60": {"invoices": [], "total_amount": 0.0},
        "overdue_90": {"invoices": [], "total_amount": 0.0},
        "overdue_90_plus": {"invoices": [], "total_amount": 0.0},
    }

    for inv, tx in rows:
        payment_status = (inv.extraction_data or {}).get("payment_status", "unpaid")
        if payment_status == "paid":
            continue

        due_date = None
        if tx and tx.due_date:
            try:
                due_date = datetime.strptime(tx.due_date[:10], "%Y-%m-%d").date()
            except Exception:
                pass
        if due_date is None and tx and tx.invoice_date:
            try:
                due_date = datetime.strptime(tx.invoice_date[:10], "%Y-%m-%d").date() + timedelta(days=30)
            except Exception:
                pass
        if due_date is None:
            due_date = inv.created_at.date() + timedelta(days=30)

        days_overdue = (today - due_date).days
        amount = (tx.total_amount if tx and tx.total_amount else 0.0)
        inv_summary = {
            "invoice_id": str(inv.id),
            "file_name": inv.file_name,
            "due_date": due_date.isoformat(),
            "days_overdue": max(0, days_overdue),
            "total_amount": amount,
            "vendor_name": tx.vendor_name if tx else None,
        }

        if days_overdue <= 0:
            bucket_key = "not_due"
        elif days_overdue <= 30:
            bucket_key = "overdue_30"
        elif days_overdue <= 60:
            bucket_key = "overdue_60"
        elif days_overdue <= 90:
            bucket_key = "overdue_90"
        else:
            bucket_key = "overdue_90_plus"

        buckets[bucket_key]["invoices"].append(inv_summary)
        buckets[bucket_key]["total_amount"] += amount

    for key in buckets:
        buckets[key]["total_amount"] = round(buckets[key]["total_amount"], 2)

    return buckets


@router.patch("/{invoice_id}/payment-status")
async def update_payment_status(
    invoice_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.COMPANY_ADMIN, UserRole.FIRM_ADMIN)),
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Not found")
    data = invoice.extraction_data or {}
    data["payment_status"] = payload.get("status", "paid")
    data["paid_date"] = payload.get("paid_date")
    data["payment_method"] = payload.get("payment_method")
    invoice.extraction_data = data
    invoice.updated_at = datetime.utcnow()
    await db.commit()
    return {"payment_status": data["payment_status"]}


@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    _check_invoice_access(invoice, current_user)

    # Get transaction
    tx_result = await db.execute(
        select(ExtractedTransaction).where(ExtractedTransaction.invoice_id == invoice_id)
    )
    tx = tx_result.scalar_one_or_none()

    reviewer = None
    if invoice.reviewed_by:
        reviewer_user = await db.get(User, invoice.reviewed_by)
        if reviewer_user:
            reviewer = {"name": reviewer_user.full_name, "role": reviewer_user.role.value}

    data = _invoice_to_dict(invoice)
    data["reviewer"] = reviewer
    if tx:
        head_name = None
        if tx.payment_head_id:
            from app.models.company import PaymentHead
            head = await db.get(PaymentHead, tx.payment_head_id)
            head_name = head.name if head else None
        from app.models.company import Company as _Company
        _co = await db.get(_Company, invoice.company_id)
        data["transaction"] = _tx_to_dict(tx, head_name, company_gst=_co.gst_number if _co else None)
    return data


@router.patch("/{invoice_id}/review")
async def review_invoice(
    invoice_id: uuid.UUID,
    corrections: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ACCOUNTANT, UserRole.FIRM_ADMIN)),
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    tx_result = await db.execute(
        select(ExtractedTransaction).where(ExtractedTransaction.invoice_id == invoice_id)
    )
    tx = tx_result.scalar_one_or_none()

    if tx:
        tx.corrected_data = corrections
        tx.is_corrected = True
        for field, value in corrections.items():
            if hasattr(tx, field):
                setattr(tx, field, value)
        tx.updated_at = datetime.utcnow()

    await create_audit_log(
        db=db,
        action=AuditAction.INVOICE_CORRECTION_SUBMITTED,
        entity_type="invoice",
        entity_id=str(invoice_id),
        user_id=current_user.id,
        details={"corrections": corrections},
    )
    await db.commit()
    return {"message": "Corrections saved"}


@router.post("/{invoice_id}/accept")
async def accept_invoice(
    invoice_id: uuid.UUID,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ACCOUNTANT, UserRole.FIRM_ADMIN)),
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice.status = TransactionStatus.ACCEPTED
    invoice.reviewed_by = current_user.id
    invoice.reviewer_notes = notes
    invoice.reviewed_at = datetime.utcnow()
    invoice.updated_at = datetime.utcnow()

    await create_audit_log(
        db=db,
        action=AuditAction.INVOICE_ACCEPTED,
        entity_type="invoice",
        entity_id=str(invoice_id),
        user_id=current_user.id,
        details={"notes": notes},
    )

    # Notify company users
    await _notify_company_users(db, invoice, "accepted", current_user.full_name)
    await db.commit()
    return {"message": "Invoice accepted", "status": "accepted"}


@router.post("/{invoice_id}/reject")
async def reject_invoice(
    invoice_id: uuid.UUID,
    reason: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ACCOUNTANT, UserRole.FIRM_ADMIN)),
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice.status = TransactionStatus.REJECTED
    invoice.reviewed_by = current_user.id
    invoice.reviewer_notes = reason
    invoice.reviewed_at = datetime.utcnow()
    invoice.updated_at = datetime.utcnow()

    await create_audit_log(
        db=db,
        action=AuditAction.INVOICE_REJECTED,
        entity_type="invoice",
        entity_id=str(invoice_id),
        user_id=current_user.id,
        details={"reason": reason},
    )

    await _notify_company_users(db, invoice, "rejected", current_user.full_name)
    await db.commit()
    return {"message": "Invoice rejected", "status": "rejected"}


@router.patch("/{invoice_id}/category")
async def update_invoice_category(
    invoice_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(
        UserRole.ACCOUNTANT, UserRole.FIRM_ADMIN, UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER
    )),
):
    tx_result = await db.execute(
        select(ExtractedTransaction).where(ExtractedTransaction.invoice_id == invoice_id)
    )
    tx = tx_result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    head_id = payload.get("payment_head_id")
    if head_id:
        from app.models.company import PaymentHead
        head = await db.get(PaymentHead, uuid.UUID(head_id))
        if not head or head.company_id != tx.company_id:
            raise HTTPException(status_code=400, detail="Invalid payment head")
        tx.payment_head_id = head.id
        head_name = head.name
    else:
        tx.payment_head_id = None
        head_name = None

    await db.commit()
    return {"payment_head_id": head_id, "payment_head_name": head_name}


@router.get("/{invoice_id}/audit")
async def get_invoice_audit(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    invoice = await db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    _check_invoice_access(invoice, current_user)

    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.entity_type == "invoice", AuditLog.entity_id == str(invoice_id))
        .order_by(AuditLog.created_at.desc())
    )
    logs = result.scalars().all()

    out = []
    for log in logs:
        user = await db.get(User, log.user_id) if log.user_id else None
        out.append({
            "id": str(log.id),
            "action": log.action.value,
            "user_name": user.full_name if user else "System",
            "user_role": user.role.value if user else None,
            "details": log.details,
            "created_at": log.created_at.isoformat(),
        })
    return out




async def _notify_company_users(db: AsyncSession, invoice: Invoice, status: str, reviewer_name: str):
    from sqlalchemy import select
    from app.models.user import User, UserRole
    result = await db.execute(
        select(User).where(
            User.company_id == invoice.company_id,
            User.is_active == True,
        )
    )
    users = result.scalars().all()
    user_ids = [u.id for u in users]
    if user_ids:
        await notify_company_invoice_status(db, user_ids, invoice.id, status, reviewer_name)


def _check_invoice_access(invoice: Invoice, user: User):
    if user.role in [UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]:
        if invoice.company_id != user.company_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user.role == UserRole.PLATFORM_ADMIN:
        pass


def _invoice_to_dict(inv: Invoice, tx=None) -> dict:
    return {
        "id": str(inv.id),
        "company_id": str(inv.company_id),
        "file_name": inv.file_name,
        "file_url": inv.file_url,
        "file_type": inv.file_type,
        "invoice_type": inv.invoice_type.value,
        "status": inv.status.value,
        "trust_score": inv.trust_score,
        "risk_level": _get_risk_level(inv.trust_score),
        "confidence_scores": inv.confidence_scores,
        "conflicts": inv.conflicts,
        "processing_status": (inv.extraction_data or {}).get("processing_status"),
        "reviewer_notes": inv.reviewer_notes,
        "reviewed_at": inv.reviewed_at.isoformat() if inv.reviewed_at else None,
        "created_at": inv.created_at.isoformat(),
        "updated_at": inv.updated_at.isoformat(),
        "duplicate_of": str(inv.duplicate_of) if inv.duplicate_of else None,
        "is_duplicate": inv.duplicate_of is not None,
        "payment_status": (inv.extraction_data or {}).get("payment_status", "unpaid"),
        "paid_date": (inv.extraction_data or {}).get("paid_date"),
        "payment_method": (inv.extraction_data or {}).get("payment_method"),
        "utr_number": (inv.extraction_data or {}).get("utr_number"),
        "bank_name": (inv.extraction_data or {}).get("bank_name"),
        "transaction": {
            "vendor_name": tx.vendor_name if tx else None,
            "invoice_number": tx.invoice_number if tx else None,
            "invoice_date": tx.invoice_date if tx else None,
            "total_amount": float(tx.total_amount) if tx and tx.total_amount else None,
            "tax_amount": float(tx.tax_amount) if tx and tx.tax_amount else None,
            "vendor_gst": tx.vendor_gst if tx else None,
        } if tx else None,
    }


def _gst_state_code(gst: str | None) -> str | None:
    """Extract 2-digit state code from a GST number (first 2 digits)."""
    if gst and len(gst.strip()) >= 2:
        code = gst.strip()[:2]
        if code.isdigit():
            return code
    return None


def _compute_gst_split(tax_amount: float | None, vendor_gst: str | None, company_gst: str | None) -> dict:
    """
    Determine CGST/SGST/IGST split based on GST state codes.
    Intra-state (same state): CGST = SGST = tax/2, IGST = 0
    Inter-state (different states): IGST = tax, CGST = SGST = 0
    Unknown: fall back to intra-state assumption.
    """
    if not tax_amount:
        return {"cgst": None, "sgst": None, "igst": None, "gst_type": "unknown"}

    vendor_state = _gst_state_code(vendor_gst)
    company_state = _gst_state_code(company_gst)

    if vendor_state and company_state and vendor_state != company_state:
        # Inter-state supply → IGST only
        return {
            "cgst": 0.0,
            "sgst": 0.0,
            "igst": round(float(tax_amount), 2),
            "gst_type": "inter_state",
        }
    else:
        # Intra-state supply → CGST + SGST equal split
        half = round(float(tax_amount) / 2, 2)
        return {
            "cgst": half,
            "sgst": half,
            "igst": 0.0,
            "gst_type": "intra_state",
        }


def _tx_to_dict(tx: ExtractedTransaction, head_name: str | None = None, company_gst: str | None = None) -> dict:
    gst_split = _compute_gst_split(tx.tax_amount, tx.vendor_gst, company_gst)
    return {
        "id": str(tx.id),
        "vendor_name": tx.vendor_name,
        "vendor_gst": tx.vendor_gst,
        "invoice_number": tx.invoice_number,
        "invoice_date": tx.invoice_date,
        "due_date": tx.due_date,
        "subtotal": tx.subtotal,
        "tax_amount": tx.tax_amount,
        "total_amount": tx.total_amount,
        "currency": tx.currency,
        "line_items": tx.line_items,
        "corrected_data": tx.corrected_data,
        "is_corrected": tx.is_corrected,
        "payment_head_id": str(tx.payment_head_id) if tx.payment_head_id else None,
        "payment_head_name": head_name,
        **gst_split,
    }


def _get_risk_level(trust_score) -> str:
    if trust_score is None:
        return "unknown"
    if trust_score >= 85:
        return "safe"
    elif trust_score >= 60:
        return "review"
    return "high_risk"
