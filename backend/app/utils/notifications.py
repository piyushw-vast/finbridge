import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.notification import Notification, NotificationType


async def create_notification(
    db: AsyncSession,
    recipient_id: uuid.UUID,
    type: NotificationType,
    title: str,
    message: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    extra_data: dict | None = None,
) -> Notification:
    notification = Notification(
        recipient_id=recipient_id,
        type=type,
        title=title,
        message=message,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        extra_data=extra_data,
    )
    db.add(notification)
    await db.flush()
    return notification


async def notify_accountants_new_invoice(
    db: AsyncSession,
    accountant_ids: list[uuid.UUID],
    invoice_id: uuid.UUID,
    company_name: str,
    trust_score: float,
) -> None:
    for accountant_id in accountant_ids:
        await create_notification(
            db=db,
            recipient_id=accountant_id,
            type=NotificationType.INVOICE_NEEDS_REVIEW,
            title="New Invoice for Review",
            message=f"A new invoice from {company_name} needs review. Trust Score: {trust_score:.0f}/100",
            entity_type="invoice",
            entity_id=str(invoice_id),
            extra_data={"trust_score": trust_score},
        )


async def notify_company_invoice_status(
    db: AsyncSession,
    company_user_ids: list[uuid.UUID],
    invoice_id: uuid.UUID,
    status: str,
    reviewer_name: str,
) -> None:
    accepted = status == "accepted"
    for user_id in company_user_ids:
        await create_notification(
            db=db,
            recipient_id=user_id,
            type=NotificationType.INVOICE_ACCEPTED if accepted else NotificationType.INVOICE_REJECTED,
            title=f"Invoice {status.capitalize()}",
            message=f"Your invoice has been {'accepted' if accepted else 'rejected'} by {reviewer_name}.",
            entity_type="invoice",
            entity_id=str(invoice_id),
        )
