from pydantic import BaseModel, EmailStr
from app.models.company import BusinessType
import uuid
from datetime import datetime


class PaymentSubHeadCreate(BaseModel):
    name: str
    description: str | None = None


class PaymentSubHeadOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    is_active: bool

    class Config:
        from_attributes = True


class PaymentHeadCreate(BaseModel):
    name: str
    description: str | None = None
    sub_heads: list[PaymentSubHeadCreate] = []


class PaymentHeadUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class PaymentHeadOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    is_active: bool
    sub_heads: list[PaymentSubHeadOut] = []

    class Config:
        from_attributes = True


class CompanyCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    gst_number: str | None = None
    pan_number: str | None = None
    address: str | None = None
    business_type: BusinessType = BusinessType.OTHER
    # Admin user for this company
    admin_full_name: str
    admin_email: EmailStr
    admin_password: str
    # Default payment heads based on business type
    payment_heads: list[PaymentHeadCreate] = []


class CompanyUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    gst_number: str | None = None
    pan_number: str | None = None
    address: str | None = None
    business_type: BusinessType | None = None
    is_active: bool | None = None


class CompanyOut(BaseModel):
    id: uuid.UUID
    firm_id: uuid.UUID
    name: str
    slug: str
    email: str
    phone: str | None = None
    gst_number: str | None = None
    pan_number: str | None = None
    address: str | None = None
    business_type: BusinessType
    logo_url: str | None = None
    is_active: bool
    created_at: datetime
    payment_heads: list[PaymentHeadOut] = []

    class Config:
        from_attributes = True
