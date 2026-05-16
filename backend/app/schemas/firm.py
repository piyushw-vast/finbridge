from pydantic import BaseModel, EmailStr
import uuid
from datetime import datetime


class FirmCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    address: str | None = None
    # Admin user for this firm
    admin_full_name: str
    admin_email: EmailStr
    admin_password: str


class FirmUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    address: str | None = None
    is_active: bool | None = None


class FirmOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    email: str
    phone: str | None = None
    address: str | None = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
