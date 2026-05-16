import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.core.deps import get_current_user, require_roles
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.company import Company, PaymentHead, PaymentSubHead
from app.utils.audit import create_audit_log
from app.models.audit import AuditAction

router = APIRouter()


class PaymentHeadCreate(BaseModel):
    name: str
    description: Optional[str] = None


class PaymentSubHeadCreate(BaseModel):
    name: str
    description: Optional[str] = None


@router.get("/companies/{company_id}/payment-heads")
async def get_payment_heads(
    company_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PaymentHead).where(
            PaymentHead.company_id == company_id,
            PaymentHead.is_active == True,
        )
    )
    heads = result.scalars().all()

    output = []
    for head in heads:
        sub_result = await db.execute(
            select(PaymentSubHead).where(
                PaymentSubHead.head_id == head.id,
                PaymentSubHead.is_active == True,
            )
        )
        subs = sub_result.scalars().all()
        output.append({
            "id": str(head.id),
            "name": head.name,
            "description": head.description,
            "sub_heads": [
                {"id": str(s.id), "name": s.name, "description": s.description}
                for s in subs
            ],
        })
    return output


@router.post("/companies/{company_id}/payment-heads")
async def create_payment_head(
    company_id: uuid.UUID,
    data: PaymentHeadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.FIRM_ADMIN, UserRole.PLATFORM_ADMIN)),
):
    head = PaymentHead(
        company_id=company_id,
        name=data.name,
        description=data.description,
    )
    db.add(head)
    await db.flush()
    await create_audit_log(
        db=db, action=AuditAction.COMPANY_CREATED,
        entity_type="payment_head", entity_id=str(head.id),
        user_id=current_user.id, details={"name": data.name},
    )
    await db.commit()
    return {"id": str(head.id), "name": head.name, "message": "Payment head created"}


@router.post("/payment-heads/{head_id}/sub-heads")
async def create_sub_head(
    head_id: uuid.UUID,
    data: PaymentSubHeadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.FIRM_ADMIN, UserRole.PLATFORM_ADMIN)),
):
    head = await db.get(PaymentHead, head_id)
    if not head:
        raise HTTPException(status_code=404, detail="Payment head not found")

    sub = PaymentSubHead(head_id=head_id, name=data.name, description=data.description)
    db.add(sub)
    await db.commit()
    return {"id": str(sub.id), "name": sub.name, "message": "Sub-head created"}


@router.delete("/payment-heads/{head_id}")
async def delete_payment_head(
    head_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.FIRM_ADMIN, UserRole.PLATFORM_ADMIN)),
):
    head = await db.get(PaymentHead, head_id)
    if not head:
        raise HTTPException(status_code=404, detail="Not found")
    head.is_active = False
    await db.commit()
    return {"message": "Payment head deactivated"}
