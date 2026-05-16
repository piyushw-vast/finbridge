from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import hash_password
from app.core.deps import get_current_user, require_roles
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate, UserOut
import uuid

router = APIRouter()


@router.get("/", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PLATFORM_ADMIN, UserRole.FIRM_ADMIN)),
):
    query = select(User).order_by(User.created_at.desc())
    if current_user.role == UserRole.FIRM_ADMIN:
        query = query.where(User.firm_id == current_user.firm_id)
    result = await db.execute(query)
    return [UserOut.model_validate(u) for u in result.scalars().all()]


@router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PLATFORM_ADMIN, UserRole.FIRM_ADMIN)),
):
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Firm admin can only create accountants and company users
    if current_user.role == UserRole.FIRM_ADMIN:
        if payload.role not in [UserRole.ACCOUNTANT, UserRole.COMPANY_ADMIN, UserRole.COMPANY_USER]:
            raise HTTPException(status_code=403, detail="Cannot create this role")
        payload.firm_id = current_user.firm_id

    user = User(
        id=uuid.uuid4(),
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        firm_id=payload.firm_id,
        company_id=payload.company_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PLATFORM_ADMIN, UserRole.FIRM_ADMIN)),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.PLATFORM_ADMIN, UserRole.FIRM_ADMIN)),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await db.commit()
