import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog, AuditAction


async def create_audit_log(
    db: AsyncSession,
    action: AuditAction,
    entity_type: str,
    entity_id: str | None = None,
    user_id: uuid.UUID | None = None,
    details: dict | None = None,
    ip_address: str | None = None,  # kept for call-site compatibility, not stored
) -> AuditLog:
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        details=details,
    )
    db.add(log)
    await db.flush()
    return log
