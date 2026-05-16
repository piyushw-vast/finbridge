from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.security import hash_password
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.company import Company, PaymentHead, PaymentSubHead
from app.schemas.company import (
    CompanyCreate, CompanyUpdate, CompanyOut,
    PaymentHeadCreate, PaymentHeadUpdate, PaymentHeadOut,
)
from app.utils.slug import slugify
from app.utils.payment_heads import get_default_heads
import uuid
from datetime import datetime

router = APIRouter()


async def _get_company_with_heads(db: AsyncSession, company_id: uuid.UUID) -> Company:
    result = await db.execute(
        select(Company)
        .where(Company.id == company_id)
        .options(selectinload(Company.payment_heads).selectinload(PaymentHead.sub_heads))
    )
    return result.scalar_one_or_none()


@router.get("/", response_model=list[CompanyOut])
async def list_companies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PLATFORM_ADMIN, UserRole.FIRM_ADMIN)),
):
    query = (
        select(Company)
        .options(selectinload(Company.payment_heads).selectinload(PaymentHead.sub_heads))
        .order_by(Company.created_at.desc())
    )
    if current_user.role == UserRole.FIRM_ADMIN:
        query = query.where(Company.firm_id == current_user.firm_id)

    result = await db.execute(query)
    return [CompanyOut.model_validate(c) for c in result.scalars().all()]


@router.post("/", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
async def create_company(
    payload: CompanyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.FIRM_ADMIN)),
):
    existing = await db.execute(select(User).where(User.email == payload.admin_email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Admin email already registered")

    company = Company(
        id=uuid.uuid4(),
        firm_id=current_user.firm_id,
        name=payload.name,
        slug=slugify(payload.name),
        email=payload.email,
        phone=payload.phone,
        gst_number=payload.gst_number,
        pan_number=payload.pan_number,
        address=payload.address,
        business_type=payload.business_type,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(company)
    await db.flush()

    # Create company admin user
    admin = User(
        id=uuid.uuid4(),
        email=payload.admin_email,
        hashed_password=hash_password(payload.admin_password),
        full_name=payload.admin_full_name,
        role=UserRole.COMPANY_ADMIN,
        firm_id=current_user.firm_id,
        company_id=company.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(admin)

    # Use provided payment heads or fall back to business type defaults
    heads_data = payload.payment_heads or []
    if not heads_data:
        defaults = get_default_heads(payload.business_type.value)
        heads_data = [
            PaymentHeadCreate(name=d["name"], sub_heads=[{"name": s} for s in d["sub_heads"]])
            for d in defaults
        ]

    for head_data in heads_data:
        head = PaymentHead(
            id=uuid.uuid4(),
            company_id=company.id,
            name=head_data.name,
            description=head_data.description,
            created_at=datetime.utcnow(),
        )
        db.add(head)
        await db.flush()

        for sub in head_data.sub_heads:
            db.add(PaymentSubHead(
                id=uuid.uuid4(),
                head_id=head.id,
                name=sub.name,
                description=getattr(sub, 'description', None),
                created_at=datetime.utcnow(),
            ))

    await db.commit()
    company = await _get_company_with_heads(db, company.id)
    return CompanyOut.model_validate(company)


@router.get("/firm/stats")
async def get_firm_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.FIRM_ADMIN, UserRole.ACCOUNTANT)),
):
    from app.models.invoice import Invoice, ExtractedTransaction, TransactionStatus
    from sqlalchemy import func

    companies_result = await db.execute(
        select(Company).where(Company.firm_id == current_user.firm_id)
    )
    companies = companies_result.scalars().all()
    company_ids = [c.id for c in companies]

    if not company_ids:
        return {"total_companies": 0, "total_invoices": 0, "pending_review": 0, "accepted": 0, "high_risk": 0, "avg_trust_score": 0, "companies": []}

    inv_result = await db.execute(
        select(Invoice).where(Invoice.company_id.in_(company_ids))
    )
    all_invoices = inv_result.scalars().all()

    company_stats = []
    for c in companies:
        c_invs = [i for i in all_invoices if i.company_id == c.id]
        pending = sum(1 for i in c_invs if i.status in [TransactionStatus.UNDER_REVIEW, TransactionStatus.NEEDS_CORRECTION])
        company_stats.append({
            "id": str(c.id),
            "name": c.name,
            "business_type": c.business_type.value,
            "total": len(c_invs),
            "pending_review": pending,
            "accepted": sum(1 for i in c_invs if i.status == TransactionStatus.ACCEPTED),
            "high_risk": sum(1 for i in c_invs if i.trust_score and i.trust_score < 60),
        })

    scores = [i.trust_score for i in all_invoices if i.trust_score]

    return {
        "total_companies": len(companies),
        "total_invoices": len(all_invoices),
        "pending_review": sum(1 for i in all_invoices if i.status in [TransactionStatus.UNDER_REVIEW, TransactionStatus.NEEDS_CORRECTION]),
        "accepted": sum(1 for i in all_invoices if i.status == TransactionStatus.ACCEPTED),
        "high_risk": sum(1 for i in all_invoices if i.trust_score and i.trust_score < 60),
        "avg_trust_score": round(sum(scores) / len(scores), 1) if scores else 0,
        "companies": sorted(company_stats, key=lambda x: -x["pending_review"]),
    }


@router.get("/{company_id}/firm-info")
async def get_company_firm_info(
    company_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.firm import AccountingFirm
    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    firm = await db.get(AccountingFirm, company.firm_id)
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found")

    accountants_result = await db.execute(
        select(User).where(User.firm_id == firm.id, User.role == UserRole.ACCOUNTANT, User.is_active == True)
    )
    accountants = accountants_result.scalars().all()

    return {
        "firm_name": firm.name,
        "firm_email": firm.email,
        "firm_phone": firm.phone,
        "accountants": [{"name": a.full_name, "email": a.email} for a in accountants],
    }


@router.get("/{company_id}", response_model=CompanyOut)
async def get_company(
    company_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company = await _get_company_with_heads(db, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return CompanyOut.model_validate(company)


@router.patch("/{company_id}", response_model=CompanyOut)
async def update_company(
    company_id: uuid.UUID,
    payload: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.FIRM_ADMIN, UserRole.PLATFORM_ADMIN)),
):
    company = await _get_company_with_heads(db, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(company, field, value)
    company.updated_at = datetime.utcnow()

    await db.commit()
    company = await _get_company_with_heads(db, company_id)
    return CompanyOut.model_validate(company)


# --- Payment Heads ---

@router.get("/{company_id}/payment-heads", response_model=list[PaymentHeadOut])
async def list_payment_heads(
    company_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PaymentHead)
        .where(PaymentHead.company_id == company_id)
        .options(selectinload(PaymentHead.sub_heads))
        .order_by(PaymentHead.created_at.desc())
    )
    return [PaymentHeadOut.model_validate(h) for h in result.scalars().all()]


@router.post("/{company_id}/payment-heads", response_model=PaymentHeadOut, status_code=201)
async def add_payment_head(
    company_id: uuid.UUID,
    payload: PaymentHeadCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.FIRM_ADMIN, UserRole.PLATFORM_ADMIN)),
):
    head = PaymentHead(
        id=uuid.uuid4(),
        company_id=company_id,
        name=payload.name,
        description=payload.description,
        created_at=datetime.utcnow(),
    )
    db.add(head)
    await db.flush()

    for sub in payload.sub_heads:
        db.add(PaymentSubHead(
            id=uuid.uuid4(),
            head_id=head.id,
            name=sub.name,
            description=sub.description,
            created_at=datetime.utcnow(),
        ))

    await db.commit()
    result = await db.execute(
        select(PaymentHead).where(PaymentHead.id == head.id).options(selectinload(PaymentHead.sub_heads))
    )
    return PaymentHeadOut.model_validate(result.scalar_one())


@router.patch("/{company_id}/payment-heads/{head_id}", response_model=PaymentHeadOut)
async def update_payment_head(
    company_id: uuid.UUID,
    head_id: uuid.UUID,
    payload: PaymentHeadUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.FIRM_ADMIN, UserRole.PLATFORM_ADMIN)),
):
    result = await db.execute(
        select(PaymentHead).where(PaymentHead.id == head_id, PaymentHead.company_id == company_id)
        .options(selectinload(PaymentHead.sub_heads))
    )
    head = result.scalar_one_or_none()
    if not head:
        raise HTTPException(status_code=404, detail="Payment head not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(head, field, value)

    await db.commit()
    await db.refresh(head)
    return PaymentHeadOut.model_validate(head)


@router.post("/{company_id}/logo")
async def upload_company_logo(
    company_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.company_id != company_id and current_user.role not in [UserRole.FIRM_ADMIN, UserRole.PLATFORM_ADMIN]:
        raise HTTPException(status_code=403, detail="Access denied")

    company = await db.get(Company, company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    content_type = file.content_type or "image/png"
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    file_bytes = await file.read()
    ext = file.filename.rsplit(".", 1)[-1] if "." in file.filename else "png"
    logo_path = f"logos/{company_id}.{ext}"

    try:
        from supabase import create_client
        from app.core.config import settings
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
        try:
            supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).remove([logo_path])
        except Exception:
            pass
        supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).upload(
            logo_path, file_bytes, {"content-type": content_type}
        )
        logo_url = supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).get_public_url(logo_path)
        if isinstance(logo_url, dict):
            logo_url = logo_url.get("publicUrl") or logo_url.get("publicURL", "")
    except Exception:
        logo_url = f"/api/placeholder/logo/{company_id}"

    company.logo_url = logo_url
    company.updated_at = datetime.utcnow()
    await db.commit()
    return {"logo_url": logo_url}
