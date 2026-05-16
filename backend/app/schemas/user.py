from pydantic import BaseModel, EmailStr
from app.models.user import UserRole
import uuid


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole
    firm_id: uuid.UUID | None = None
    company_id: uuid.UUID | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    is_active: bool | None = None
    firm_id: uuid.UUID | None = None
    company_id: uuid.UUID | None = None


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: UserRole
    firm_id: str | None = None
    company_id: str | None = None
    is_active: bool

    model_config = {"from_attributes": True, "arbitrary_types_allowed": True}

    @classmethod
    def model_validate(cls, obj, **kwargs):
        data = {
            "id": str(obj.id),
            "email": obj.email,
            "full_name": obj.full_name,
            "role": obj.role,
            "firm_id": str(obj.firm_id) if obj.firm_id else None,
            "company_id": str(obj.company_id) if obj.company_id else None,
            "is_active": obj.is_active,
        }
        return cls(**data)
