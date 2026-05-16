from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.security import hash_password
from app.core.deps import require_roles
from app.models.user import User, UserRole
from app.models.firm import AccountingFirm
from app.schemas.firm import FirmCreate, FirmUpdate, FirmOut
from app.utils.slug import slugify
import uuid
from datetime import datetime

router = APIRouter()


@router.get("/", response_model=list[FirmOut])
async def list_firms(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.PLATFORM_ADMIN)),
):
    result = await db.execute(select(AccountingFirm).order_by(AccountingFirm.created_at.desc()))
    return [FirmOut.model_validate(f) for f in result.scalars().all()]


@router.post("/", response_model=FirmOut, status_code=status.HTTP_201_CREATED)
async def create_firm(
    payload: FirmCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.PLATFORM_ADMIN)),
):
    # Check admin email not taken
    existing = await db.execute(select(User).where(User.email == payload.admin_email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Admin email already registered")

    firm = AccountingFirm(
        id=uuid.uuid4(),
        name=payload.name,
        slug=slugify(payload.name),
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(firm)
    await db.flush()  # get firm.id before creating user

    admin = User(
        id=uuid.uuid4(),
        email=payload.admin_email,
        hashed_password=hash_password(payload.admin_password),
        full_name=payload.admin_full_name,
        role=UserRole.FIRM_ADMIN,
        firm_id=firm.id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(admin)
    await db.commit()
    await db.refresh(firm)
    return FirmOut.model_validate(firm)


@router.get("/{firm_id}", response_model=FirmOut)
async def get_firm(
    firm_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.PLATFORM_ADMIN, UserRole.FIRM_ADMIN)),
):
    result = await db.execute(select(AccountingFirm).where(AccountingFirm.id == firm_id))
    firm = result.scalar_one_or_none()
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found")
    return FirmOut.model_validate(firm)


@router.patch("/{firm_id}", response_model=FirmOut)
async def update_firm(
    firm_id: uuid.UUID,
    payload: FirmUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.PLATFORM_ADMIN)),
):
    result = await db.execute(select(AccountingFirm).where(AccountingFirm.id == firm_id))
    firm = result.scalar_one_or_none()
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(firm, field, value)
    firm.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(firm)
    return FirmOut.model_validate(firm)


@router.delete("/{firm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_firm(
    firm_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.PLATFORM_ADMIN)),
):
    result = await db.execute(select(AccountingFirm).where(AccountingFirm.id == firm_id))
    firm = result.scalar_one_or_none()
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found")
    firm.is_active = False
    firm.updated_at = datetime.utcnow()
    await db.commit()
