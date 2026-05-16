"""
Run: python seeds/seed.py
Full demo dataset for hackathon presentation.
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import text
from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.firm import AccountingFirm
from app.models.company import Company, PaymentHead, PaymentSubHead, BusinessType
from app.models.invoice import Invoice, ExtractedTransaction, TransactionStatus, InvoiceType
from app.models.report import Report, ReportType
from app.models.audit import AuditLog, AuditAction
from app.models.notification import Notification, NotificationType
from app.utils.slug import slugify
from app.utils.payment_heads import get_default_heads
import uuid
from datetime import datetime, timedelta

engine = create_async_engine(settings.DATABASE_URL)
Session = async_sessionmaker(engine, expire_on_commit=False)

NOW = datetime.utcnow()

def dt(days_ago, hour=10, minute=0):
    return NOW - timedelta(days=days_ago, hours=-hour, minutes=-minute)


async def seed():
    async with Session() as db:

        # ── Ensure schema up to date ──────────────────────────────────
        await db.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)"))
        await db.commit()

        # ── Wipe in dependency order ──────────────────────────────────
        for table in [
            "notifications", "audit_logs", "invoice_comments",
            "extracted_transactions", "invoices", "reports",
            "payment_sub_heads", "payment_heads",
            "users", "companies", "accounting_firms",
        ]:
            await db.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE"))
        await db.commit()

        # ═══════════════════════════════════════════════════════════════
        # PLATFORM ADMIN
        # ═══════════════════════════════════════════════════════════════
        platform_admin = User(
            id=uuid.uuid4(), email="admin@finbridge.com",
            hashed_password=hash_password("admin123"),
            full_name="Arjun Mehta", role=UserRole.PLATFORM_ADMIN,
            created_at=dt(180), updated_at=dt(180),
        )
        db.add(platform_admin)

        # ═══════════════════════════════════════════════════════════════
        # ACCOUNTING FIRM
        # ═══════════════════════════════════════════════════════════════
        firm = AccountingFirm(
            id=uuid.uuid4(),
            name="Mehta & Associates, Chartered Accountants",
            slug=slugify("Mehta & Associates"),
            email="contact@mehtaca.com",
            phone="+91 98200 43210",
            created_at=dt(120), updated_at=dt(120),
        )
        db.add(firm)
        await db.flush()

        # ── Firm users ────────────────────────────────────────────────
        firm_admin = User(
            id=uuid.uuid4(), email="firmadmin@demo.com",
            hashed_password=hash_password("firm123"),
            full_name="Deepak Mehta", role=UserRole.FIRM_ADMIN,
            firm_id=firm.id, created_at=dt(120), updated_at=dt(120),
        )
        accountant1 = User(
            id=uuid.uuid4(), email="accountant@demo.com",
            hashed_password=hash_password("acc123"),
            full_name="Priya Sharma", role=UserRole.ACCOUNTANT,
            firm_id=firm.id, created_at=dt(90), updated_at=dt(90),
        )
        accountant2 = User(
            id=uuid.uuid4(), email="accountant2@demo.com",
            hashed_password=hash_password("acc123"),
            full_name="Rohit Kulkarni", role=UserRole.ACCOUNTANT,
            firm_id=firm.id, created_at=dt(90), updated_at=dt(90),
        )
        accountant3 = User(
            id=uuid.uuid4(), email="accountant3@demo.com",
            hashed_password=hash_password("acc123"),
            full_name="Sneha Iyer", role=UserRole.ACCOUNTANT,
            firm_id=firm.id, created_at=dt(60), updated_at=dt(60),
        )
        for u in [firm_admin, accountant1, accountant2, accountant3]:
            db.add(u)

        # ═══════════════════════════════════════════════════════════════
        # COMPANY 1 — Acme Technologies Pvt Ltd (IT / SaaS)
        # GST: Maharashtra (27), trust: established vendor
        # ═══════════════════════════════════════════════════════════════
        company1 = Company(
            id=uuid.uuid4(), firm_id=firm.id,
            name="Acme Technologies Pvt Ltd",
            slug=slugify("Acme Technologies Pvt Ltd"),
            email="finance@acmetechnologies.in",
            phone="+91 22 4567 8901",
            gst_number="27AABCU9603R1ZX",
            pan_number="AABCU9603R",
            business_type=BusinessType.IT,
            logo_url="https://api.dicebear.com/7.x/initials/svg?seed=Acme%20Technologies&backgroundColor=4f46e5&textColor=ffffff&fontSize=38",
            created_at=dt(90), updated_at=dt(90),
        )
        db.add(company1)
        await db.flush()

        cadmin1 = User(
            id=uuid.uuid4(), email="companyadmin@acme.com",
            hashed_password=hash_password("company123"),
            full_name="Vikram Nair", role=UserRole.COMPANY_ADMIN,
            firm_id=firm.id, company_id=company1.id,
            created_at=dt(90), updated_at=dt(90),
        )
        cuser1 = User(
            id=uuid.uuid4(), email="user@acme.com",
            hashed_password=hash_password("user123"),
            full_name="Anita Desai", role=UserRole.COMPANY_USER,
            firm_id=firm.id, company_id=company1.id,
            created_at=dt(90), updated_at=dt(90),
        )
        db.add(cadmin1); db.add(cuser1)

        # Payment heads — IT company
        it_heads_map = {}
        for hd in get_default_heads("it"):
            h = PaymentHead(
                id=uuid.uuid4(), company_id=company1.id,
                name=hd["name"], created_at=dt(89),
            )
            db.add(h)
            await db.flush()
            it_heads_map[hd["name"]] = h.id
            for sn in hd["sub_heads"]:
                db.add(PaymentSubHead(id=uuid.uuid4(), head_id=h.id, name=sn, created_at=dt(89)))

        # ═══════════════════════════════════════════════════════════════
        # COMPANY 2 — Bharat Agro Industries Ltd (Manufacturing)
        # GST: Gujarat (24)
        # ═══════════════════════════════════════════════════════════════
        company2 = Company(
            id=uuid.uuid4(), firm_id=firm.id,
            name="Bharat Agro Industries Ltd",
            slug=slugify("Bharat Agro Industries Ltd"),
            email="accounts@bharatagro.co.in",
            phone="+91 79 2345 6789",
            gst_number="24AABCB1234C1ZK",
            pan_number="AABCB1234C",
            business_type=BusinessType.MANUFACTURING,
            logo_url="https://api.dicebear.com/7.x/initials/svg?seed=Bharat%20Agro&backgroundColor=059669&textColor=ffffff&fontSize=38",
            created_at=dt(85), updated_at=dt(85),
        )
        db.add(company2)
        await db.flush()

        cadmin2 = User(
            id=uuid.uuid4(), email="companyadmin@bharat.com",
            hashed_password=hash_password("company123"),
            full_name="Suresh Patel", role=UserRole.COMPANY_ADMIN,
            firm_id=firm.id, company_id=company2.id,
            created_at=dt(85), updated_at=dt(85),
        )
        cuser2 = User(
            id=uuid.uuid4(), email="user@bharat.com",
            hashed_password=hash_password("user123"),
            full_name="Meena Joshi", role=UserRole.COMPANY_USER,
            firm_id=firm.id, company_id=company2.id,
            created_at=dt(85), updated_at=dt(85),
        )
        db.add(cadmin2); db.add(cuser2)

        # Payment heads — Manufacturing
        mfg_heads_map = {}
        for hd in get_default_heads("manufacturing"):
            h = PaymentHead(
                id=uuid.uuid4(), company_id=company2.id,
                name=hd["name"], created_at=dt(84),
            )
            db.add(h)
            await db.flush()
            mfg_heads_map[hd["name"]] = h.id
            for sn in hd["sub_heads"]:
                db.add(PaymentSubHead(id=uuid.uuid4(), head_id=h.id, name=sn, created_at=dt(84)))

        await db.flush()

        # ═══════════════════════════════════════════════════════════════
        # HELPER — create invoice + transaction + audit log
        # ═══════════════════════════════════════════════════════════════
        async def make_invoice(company, uploader, reviewer, inv_data):
            is_accepted = inv_data["status"] == TransactionStatus.ACCEPTED
            is_rejected = inv_data["status"] == TransactionStatus.REJECTED
            reviewed_by = reviewer.id if (is_accepted or is_rejected) else None
            reviewed_at = dt(inv_data["days_ago"] - 1) if (is_accepted or is_rejected) else None
            reviewer_notes = inv_data.get("reviewer_notes")

            inv = Invoice(
                id=uuid.uuid4(),
                company_id=company.id,
                uploaded_by=uploader.id,
                file_name=inv_data["file_name"],
                file_url=inv_data.get("file_url", f"https://demo.finbridge.in/files/{inv_data['file_name']}"),
                file_type=inv_data.get("file_type", "application/pdf"),
                invoice_type=inv_data["invoice_type"],
                status=inv_data["status"],
                trust_score=inv_data["trust_score"],
                extraction_data={
                    "processing_status": "complete",
                    "extractors": {
                        "claude": {"success": True, "data": {}},
                        "donut":  {"success": True, "data": {}},
                        "ocr":    {"success": inv_data["trust_score"] > 50, "data": {}},
                    },
                    "quality_metrics": {
                        "quality_score": round(inv_data["trust_score"] / 100, 2),
                        "steps_applied": ["deskew", "denoise", "sharpen", "contrast_enhance"],
                    },
                    "validation": {
                        "gst_validation": {"valid": inv_data["trust_score"] > 70, "confidence": round(inv_data["trust_score"] / 100, 2)},
                        "math_validation": {"valid": inv_data["trust_score"] > 60},
                        "overall_score": round(inv_data["trust_score"] / 100, 2),
                    },
                    **{k: v for k, v in inv_data.items() if k in ("payment_method", "utr_number", "bank_name")},
                },
                confidence_scores=inv_data.get("confidence_scores", {
                    "vendor_name": round(min(inv_data["trust_score"] / 100 + 0.05, 0.99), 2),
                    "invoice_number": round(inv_data["trust_score"] / 100, 2),
                    "invoice_date": round(min(inv_data["trust_score"] / 100 + 0.08, 0.99), 2),
                    "total_amount": round(inv_data["trust_score"] / 100, 2),
                }),
                conflicts=inv_data.get("conflicts", []),
                reviewer_notes=reviewer_notes,
                reviewed_by=reviewed_by,
                reviewed_at=reviewed_at,
                duplicate_of=inv_data.get("duplicate_of"),
                created_at=dt(inv_data["days_ago"]),
                updated_at=dt(inv_data["days_ago"] - 1) if (is_accepted or is_rejected) else dt(inv_data["days_ago"]),
            )
            db.add(inv)
            await db.flush()

            # Extracted transaction
            if "tx" in inv_data:
                tx_data = inv_data["tx"]
                from app.utils.auto_categorize import auto_assign_payment_head
                head_id = await auto_assign_payment_head(
                    db=db,
                    company_id=company.id,
                    vendor_name=tx_data.get("vendor_name"),
                    line_items=tx_data.get("line_items"),
                )
                tx = ExtractedTransaction(
                    id=uuid.uuid4(),
                    invoice_id=inv.id,
                    company_id=company.id,
                    vendor_name=tx_data.get("vendor_name"),
                    vendor_gst=tx_data.get("vendor_gst"),
                    invoice_number=tx_data.get("invoice_number"),
                    invoice_date=tx_data.get("invoice_date"),
                    due_date=tx_data.get("due_date"),
                    subtotal=tx_data.get("subtotal"),
                    tax_amount=tx_data.get("tax_amount"),
                    total_amount=tx_data.get("total_amount"),
                    currency=tx_data.get("currency", "INR"),
                    line_items=tx_data.get("line_items"),
                    payment_head_id=head_id,
                )
                if is_accepted and inv_data.get("corrections"):
                    corrections = inv_data["corrections"]
                    for field, value in corrections.items():
                        setattr(tx, field, value)
                    tx.is_corrected = True
                    tx.corrected_data = corrections
                db.add(tx)

            # Audit: uploaded
            db.add(AuditLog(
                id=uuid.uuid4(), user_id=uploader.id,
                action=AuditAction.INVOICE_UPLOADED,
                entity_type="invoice", entity_id=str(inv.id),
                details={"file_name": inv_data["file_name"], "invoice_type": inv_data["invoice_type"].value},
                created_at=dt(inv_data["days_ago"]),
            ))
            # Audit: reviewed
            if is_accepted:
                db.add(AuditLog(
                    id=uuid.uuid4(), user_id=reviewer.id,
                    action=AuditAction.INVOICE_ACCEPTED,
                    entity_type="invoice", entity_id=str(inv.id),
                    details={"trust_score": inv_data["trust_score"], "auto": inv_data["trust_score"] >= 85},
                    created_at=dt(inv_data["days_ago"] - 1),
                ))
            if is_rejected:
                db.add(AuditLog(
                    id=uuid.uuid4(), user_id=reviewer.id,
                    action=AuditAction.INVOICE_REJECTED,
                    entity_type="invoice", entity_id=str(inv.id),
                    details={"reason": reviewer_notes},
                    created_at=dt(inv_data["days_ago"] - 1),
                ))

            return inv

        # ═══════════════════════════════════════════════════════════════
        # COMPANY 1 INVOICES — Acme Technologies (IT / SaaS)
        # ═══════════════════════════════════════════════════════════════

        # ── 1. AWS Invoice May 2026 — Clean auto-accepted, trust 94 ──
        inv1 = await make_invoice(company1, cadmin1, accountant1, {
            "file_name": "AWS_Invoice_May2026.pdf",
            "file_type": "application/pdf",
            "invoice_type": InvoiceType.PURCHASE,
            "status": TransactionStatus.ACCEPTED,
            "trust_score": 94.0,
            "days_ago": 5,
            "confidence_scores": {"vendor_name": 0.97, "vendor_gst": 0.98, "invoice_number": 0.96, "invoice_date": 0.99, "total_amount": 0.99, "subtotal": 0.98, "tax_amount": 0.98},
            "conflicts": [],
            "tx": {
                "vendor_name": "Amazon Web Services India Pvt Ltd",
                "vendor_gst": "27AAGCA8717E1ZH",
                "buyer_name": "Acme Technologies Pvt Ltd",
                "buyer_gst": "27AABCU9603R1ZX",
                "invoice_number": "AWS-IN-2026-05-8821",
                "invoice_date": "2026-05-01",
                "due_date": "2026-05-15",
                "subtotal": 72033.90,
                "tax_amount": 12966.10,
                "total_amount": 85000.00,
                "currency": "INR",
                "line_items": [
                    {"description": "Amazon EC2 — t3.large (2 instances)", "quantity": 1, "unit_price": 44800.0, "amount": 44800.0},
                    {"description": "Amazon S3 — 480GB storage", "quantity": 1, "unit_price": 14433.90, "amount": 14433.90},
                    {"description": "Amazon RDS — db.t3.medium MySQL", "quantity": 1, "unit_price": 12800.0, "amount": 12800.0},
                ],
            },
        })

        # ── 2. Zoho CRM May 2026 — Clean accepted, trust 91 ──
        inv2 = await make_invoice(company1, cadmin1, accountant1, {
            "file_name": "Zoho_CRM_Subscription_May2026.pdf",
            "file_type": "application/pdf",
            "invoice_type": InvoiceType.PURCHASE,
            "status": TransactionStatus.ACCEPTED,
            "trust_score": 91.0,
            "days_ago": 4,
            "confidence_scores": {"vendor_name": 0.96, "vendor_gst": 0.95, "invoice_number": 0.94, "invoice_date": 0.98, "total_amount": 0.97},
            "conflicts": [],
            "tx": {
                "vendor_name": "Zoho Corporation Pvt Ltd",
                "vendor_gst": "33AAACZ2403L1Z1",
                "buyer_name": "Acme Technologies Pvt Ltd",
                "buyer_gst": "27AABCU9603R1ZX",
                "invoice_number": "ZOHO-INV-2026-44921",
                "invoice_date": "2026-05-01",
                "subtotal": 37288.14,
                "tax_amount": 6711.86,
                "total_amount": 44000.00,
                "currency": "INR",
                "line_items": [
                    {"description": "Zoho CRM Plus — 15 users", "quantity": 15, "unit_price": 2000.0, "amount": 30000.0},
                    {"description": "Zoho Books — Standard Plan", "quantity": 1, "unit_price": 7288.14, "amount": 7288.14},
                ],
            },
        })

        # ── 3. Office Rent May 2026 — Payment Receipt, trust 92 ──
        inv3 = await make_invoice(company1, cadmin1, accountant2, {
            "file_name": "Office_Rent_Receipt_May2026.pdf",
            "file_type": "application/pdf",
            "invoice_type": InvoiceType.PAYMENT,
            "status": TransactionStatus.ACCEPTED,
            "trust_score": 92.0,
            "days_ago": 3,
            "payment_method": "NEFT",
            "utr_number": "HDFC26051200034421",
            "bank_name": "HDFC Bank",
            "conflicts": [],
            "tx": {
                "vendor_name": "Prestige Estates & Developers",
                "invoice_number": "RENT-REC-MAY2026",
                "invoice_date": "2026-05-01",
                "total_amount": 125000.00,
                "currency": "INR",
            },
        })

        # ── 4. Logistics Vendor — CONFLICT: amount mismatch, trust 63, in review ──
        inv4 = await make_invoice(company1, cuser1, accountant1, {
            "file_name": "BlueDart_Courier_Apr2026.pdf",
            "file_type": "application/pdf",
            "invoice_type": InvoiceType.PURCHASE,
            "status": TransactionStatus.UNDER_REVIEW,
            "trust_score": 63.0,
            "days_ago": 2,
            "confidence_scores": {"vendor_name": 0.87, "vendor_gst": 0.91, "invoice_number": 0.82, "invoice_date": 0.89, "total_amount": 0.54, "subtotal": 0.51, "tax_amount": 0.49},
            "conflicts": [
                {"field": "total_amount", "description": "Groq extracted ₹1,24,500 · PyMuPDF extracted ₹1,42,500 — verify against physical copy"},
                {"field": "tax_amount", "description": "Implied tax rate 22% — exceeds standard GST rates (5/12/18/28%)"},
            ],
            "tx": {
                "vendor_name": "Blue Dart Express Ltd",
                "vendor_gst": "27AAACB2175B1ZU",
                "invoice_number": "BD/MUM/2026/49201",
                "invoice_date": "2026-04-28",
                "subtotal": 102049.18,
                "tax_amount": 22450.82,
                "total_amount": 124500.00,
                "currency": "INR",
            },
        })

        # ── 5. WhatsApp photo — HIGH RISK, trust 41, needs correction ──
        inv5 = await make_invoice(company1, cuser1, accountant1, {
            "file_name": "Canteen_Bill_Photo_Apr2026.jpg",
            "file_type": "image/jpeg",
            "invoice_type": InvoiceType.PURCHASE,
            "status": TransactionStatus.NEEDS_CORRECTION,
            "trust_score": 41.0,
            "days_ago": 1,
            "confidence_scores": {"vendor_name": 0.61, "vendor_gst": 0.22, "invoice_number": 0.38, "invoice_date": 0.55, "total_amount": 0.44},
            "conflicts": [
                {"field": "vendor_gst", "description": "GST number not found — vendor may be unregistered or number partially obscured"},
                {"field": "invoice_number", "description": "Multiple candidate values: 'C/441' vs 'G/441' — low image quality near top edge"},
                {"field": "total_amount", "description": "Handwritten amount — OCR confidence very low (0.44)"},
            ],
            "tx": {
                "vendor_name": "Sri Balaji Catering Services",
                "invoice_date": "2026-04-25",
                "total_amount": 18750.00,
                "currency": "INR",
            },
        })

        # ── 6. JetBrains License — Rejected (wrong billing entity), trust 88 ──
        inv6 = await make_invoice(company1, cadmin1, accountant2, {
            "file_name": "JetBrains_License_Apr2026.pdf",
            "file_type": "application/pdf",
            "invoice_type": InvoiceType.PURCHASE,
            "status": TransactionStatus.REJECTED,
            "trust_score": 88.0,
            "days_ago": 10,
            "reviewer_notes": "Invoice raised to 'Acme Solutions Pvt Ltd' — not our legal entity. Vendor must re-issue to 'Acme Technologies Pvt Ltd'. GST number on invoice does not match ours.",
            "conflicts": [],
            "tx": {
                "vendor_name": "JetBrains s.r.o",
                "invoice_number": "JB-IN-2026-035721",
                "invoice_date": "2026-04-15",
                "subtotal": 42372.88,
                "tax_amount": 7627.12,
                "total_amount": 50000.00,
                "currency": "INR",
            },
        })

        # ── 7. Azure April 2026 — accepted, trust 96 ──
        inv7 = await make_invoice(company1, cadmin1, accountant1, {
            "file_name": "Azure_Invoice_Apr2026.pdf",
            "file_type": "application/pdf",
            "invoice_type": InvoiceType.PURCHASE,
            "status": TransactionStatus.ACCEPTED,
            "trust_score": 96.0,
            "days_ago": 40,
            "confidence_scores": {"vendor_name": 0.98, "vendor_gst": 0.99, "invoice_number": 0.97, "invoice_date": 0.99, "total_amount": 0.99},
            "conflicts": [],
            "tx": {
                "vendor_name": "Microsoft Corporation India Pvt Ltd",
                "vendor_gst": "36AAACM2590M1ZY",
                "buyer_name": "Acme Technologies Pvt Ltd",
                "buyer_gst": "27AABCU9603R1ZX",
                "invoice_number": "MS-AZ-2026-APR-7712",
                "invoice_date": "2026-04-01",
                "subtotal": 55084.75,
                "tax_amount": 9915.25,
                "total_amount": 65000.00,
                "currency": "INR",
                "line_items": [
                    {"description": "Azure Virtual Machines D2s v3 (x3)", "quantity": 1, "amount": 38000.0},
                    {"description": "Azure SQL Database — General Purpose", "quantity": 1, "amount": 17084.75},
                ],
            },
        })

        # ── 8. AWS April 2026 — DUPLICATE of inv7-equivalent ──
        inv8 = await make_invoice(company1, cuser1, accountant1, {
            "file_name": "AWS_Invoice_Apr2026_Duplicate.pdf",
            "file_type": "application/pdf",
            "invoice_type": InvoiceType.PURCHASE,
            "status": TransactionStatus.UNDER_REVIEW,
            "trust_score": 79.0,
            "days_ago": 38,
            "confidence_scores": {"vendor_name": 0.93, "vendor_gst": 0.94, "invoice_number": 0.91, "invoice_date": 0.95, "total_amount": 0.92},
            "conflicts": [],
            "duplicate_of": inv1.id,
            "tx": {
                "vendor_name": "Amazon Web Services India Pvt Ltd",
                "vendor_gst": "27AAGCA8717E1ZH",
                "invoice_number": "AWS-IN-2026-05-8821",
                "invoice_date": "2026-05-01",
                "subtotal": 72033.90,
                "tax_amount": 12966.10,
                "total_amount": 85000.00,
                "currency": "INR",
            },
        })

        # ── 9. Salary Register April 2026 — accepted ──
        inv9 = await make_invoice(company1, cadmin1, accountant3, {
            "file_name": "Salary_Register_April2026.pdf",
            "file_type": "application/pdf",
            "invoice_type": InvoiceType.SALARY_REGISTER,
            "status": TransactionStatus.ACCEPTED,
            "trust_score": 93.0,
            "days_ago": 35,
            "confidence_scores": {"vendor_name": 0.95, "total_amount": 0.97, "invoice_date": 0.99},
            "conflicts": [],
            "tx": {
                "vendor_name": "Acme Technologies Pvt Ltd — Payroll",
                "invoice_date": "2026-04-30",
                "total_amount": 1285000.00,
                "currency": "INR",
                "line_items": [
                    {"description": "Engineering (12 employees)", "quantity": 12, "amount": 840000.0},
                    {"description": "Sales & Marketing (6 employees)", "quantity": 6, "amount": 285000.0},
                    {"description": "Operations & Admin (4 employees)", "quantity": 4, "amount": 160000.0},
                ],
            },
        })

        # ── 10. HDFC Bank Statement March 2026 — bank statement ──
        inv10 = await make_invoice(company1, cadmin1, accountant1, {
            "file_name": "HDFC_BankStatement_Mar2026.pdf",
            "file_type": "application/pdf",
            "invoice_type": InvoiceType.BANK_STATEMENT,
            "status": TransactionStatus.ACCEPTED,
            "trust_score": 87.0,
            "days_ago": 72,
            "confidence_scores": {"vendor_name": 0.91, "total_amount": 0.94, "invoice_date": 0.97},
            "conflicts": [],
            "tx": {
                "vendor_name": "HDFC Bank — Current A/C 0050XXXX8812",
                "invoice_date": "2026-03-31",
                "total_amount": 2847350.00,
                "currency": "INR",
            },
        })

        # ── 11. Jio Fiber — accepted March ──
        inv11 = await make_invoice(company1, cadmin1, accountant2, {
            "file_name": "JioFiber_Invoice_Mar2026.pdf",
            "file_type": "application/pdf",
            "invoice_type": InvoiceType.PURCHASE,
            "status": TransactionStatus.ACCEPTED,
            "trust_score": 90.0,
            "days_ago": 68,
            "confidence_scores": {"vendor_name": 0.93, "vendor_gst": 0.94, "invoice_number": 0.92, "invoice_date": 0.96, "total_amount": 0.95},
            "conflicts": [],
            "tx": {
                "vendor_name": "Reliance Jio Infocomm Ltd",
                "vendor_gst": "27AAJCR5553A1ZN",
                "invoice_number": "JIO-MUM-2026-03-81234",
                "invoice_date": "2026-03-05",
                "subtotal": 4237.29,
                "tax_amount": 762.71,
                "total_amount": 5000.00,
                "currency": "INR",
            },
        })

        # ── 12. Corrected invoice — accountant fixed the amount ──
        inv12 = await make_invoice(company1, cuser1, accountant1, {
            "file_name": "Print_Vendor_Invoice_Feb2026.pdf",
            "file_type": "application/pdf",
            "invoice_type": InvoiceType.PURCHASE,
            "status": TransactionStatus.ACCEPTED,
            "trust_score": 71.0,
            "days_ago": 102,
            "confidence_scores": {"vendor_name": 0.84, "vendor_gst": 0.79, "invoice_number": 0.76, "invoice_date": 0.88, "total_amount": 0.68},
            "conflicts": [
                {"field": "total_amount", "description": "Groq: ₹45,200 · PyMuPDF: ₹45,000 — minor discrepancy, verify printed copy"},
            ],
            "corrections": {"total_amount": 45200.0, "tax_amount": 6859.32},
            "tx": {
                "vendor_name": "Print Masters India",
                "vendor_gst": "27AAACPM001R1ZZ",
                "invoice_number": "PMI/FEB/2026/0891",
                "invoice_date": "2026-02-14",
                "subtotal": 38340.68,
                "tax_amount": 6661.32,
                "total_amount": 45000.00,
                "currency": "INR",
            },
        })

        # ── 13. Pending invoice — just uploaded, processing ──
        # (No tx, pending status, simulates an invoice freshly uploaded)
        inv13_id = uuid.uuid4()
        inv13 = Invoice(
            id=inv13_id,
            company_id=company1.id,
            uploaded_by=cuser1.id,
            file_name="Swiggy_Catering_Invoice_May2026.jpg",
            file_url="https://demo.finbridge.in/files/swiggy_may26.jpg",
            file_type="image/jpeg",
            invoice_type=InvoiceType.PURCHASE,
            status=TransactionStatus.PENDING,
            trust_score=None,
            extraction_data={"processing_status": "queued"},
            confidence_scores={},
            conflicts=[],
            created_at=dt(0, hour=9),
            updated_at=dt(0, hour=9),
        )
        db.add(inv13)
        db.add(AuditLog(
            id=uuid.uuid4(), user_id=cuser1.id,
            action=AuditAction.INVOICE_UPLOADED,
            entity_type="invoice", entity_id=str(inv13_id),
            details={"file_name": "Swiggy_Catering_Invoice_May2026.jpg"},
            created_at=dt(0, hour=9),
        ))

        # ═══════════════════════════════════════════════════════════════
        # COMPANY 2 INVOICES — Bharat Agro Industries (Manufacturing)
        # ═══════════════════════════════════════════════════════════════

        # ── 14. Raw material supplier — high value, accepted ──
        await make_invoice(company2, cadmin2, accountant2, {
            "file_name": "Pidilite_RawMaterial_May2026.pdf",
            "file_type": "application/pdf",
            "invoice_type": InvoiceType.PURCHASE,
            "status": TransactionStatus.ACCEPTED,
            "trust_score": 89.0,
            "days_ago": 6,
            "confidence_scores": {"vendor_name": 0.93, "vendor_gst": 0.91, "invoice_number": 0.90, "invoice_date": 0.95, "total_amount": 0.94},
            "conflicts": [],
            "tx": {
                "vendor_name": "Pidilite Industries Ltd",
                "vendor_gst": "27AAACPI003E1ZZ",
                "buyer_name": "Bharat Agro Industries Ltd",
                "buyer_gst": "24AABCB1234C1ZK",
                "invoice_number": "PIL/2026/05/REG/44821",
                "invoice_date": "2026-05-02",
                "subtotal": 296610.17,
                "tax_amount": 53389.83,
                "total_amount": 350000.00,
                "currency": "INR",
                "line_items": [
                    {"description": "Fevicol SH — 50KG drums (x20)", "quantity": 20, "unit_price": 8500.0, "amount": 170000.0},
                    {"description": "Dr. Fixit Waterproof coating 20L (x50)", "quantity": 50, "unit_price": 2522.20, "amount": 126110.17},
                ],
            },
        })

        # ── 15. Logistics — suspicious high amount, trust 52 ──
        await make_invoice(company2, cuser2, accountant3, {
            "file_name": "VRL_Logistics_Apr2026.pdf",
            "file_type": "application/pdf",
            "invoice_type": InvoiceType.PURCHASE,
            "status": TransactionStatus.UNDER_REVIEW,
            "trust_score": 52.0,
            "days_ago": 3,
            "confidence_scores": {"vendor_name": 0.72, "vendor_gst": 0.68, "invoice_number": 0.61, "invoice_date": 0.74, "total_amount": 0.51},
            "conflicts": [
                {"field": "total_amount", "description": "₹8,75,000 is 3.2× higher than this vendor's average invoice (₹2,71,000) — verify with logistics team"},
                {"field": "invoice_date", "description": "Invoice date is Sunday 27-Apr-2026 — unusual for a logistics firm"},
            ],
            "tx": {
                "vendor_name": "VRL Logistics Ltd",
                "vendor_gst": "29AAACV8052Q1ZH",
                "invoice_number": "VRL/AHM/2026/APR/91022",
                "invoice_date": "2026-04-27",
                "subtotal": 741525.42,
                "tax_amount": 133474.58,
                "total_amount": 875000.00,
                "currency": "INR",
            },
        })

        # ── 16. Machinery maintenance — accepted ──
        await make_invoice(company2, cadmin2, accountant2, {
            "file_name": "Kirloskar_Maintenance_Mar2026.pdf",
            "file_type": "application/pdf",
            "invoice_type": InvoiceType.PURCHASE,
            "status": TransactionStatus.ACCEPTED,
            "trust_score": 86.0,
            "days_ago": 70,
            "confidence_scores": {"vendor_name": 0.90, "vendor_gst": 0.88, "invoice_number": 0.87, "invoice_date": 0.93, "total_amount": 0.91},
            "conflicts": [],
            "tx": {
                "vendor_name": "Kirloskar Brothers Ltd",
                "vendor_gst": "27AAACK0335N1ZT",
                "invoice_number": "KBL/PUNE/2026/AMC/0341",
                "invoice_date": "2026-03-10",
                "subtotal": 105084.75,
                "tax_amount": 18915.25,
                "total_amount": 124000.00,
                "currency": "INR",
            },
        })

        # ── 17. Acme Transaction Ledger — Q1 2026 ──
        await make_invoice(company1, cadmin1, accountant1, {
            "file_name": "Acme_Ledger_Q1_2026.xlsx",
            "file_type": "application/xlsx",
            "invoice_type": InvoiceType.LEDGER,
            "status": TransactionStatus.ACCEPTED,
            "trust_score": 95.0,
            "days_ago": 30,
            "confidence_scores": {"vendor_name": 0.97, "total_amount": 0.98, "invoice_date": 0.99},
            "conflicts": [],
            "tx": {
                "vendor_name": "Acme Technologies Pvt Ltd — Accounts Ledger",
                "invoice_date": "2026-03-31",
                "total_amount": 2340000.00,
                "currency": "INR",
                "line_items": [
                    {"description": "Opening Balance", "amount": 5200000.0},
                    {"description": "Total Credits (Q1)", "amount": 8900000.0},
                    {"description": "Total Debits (Q1)", "amount": 2340000.0},
                    {"description": "Closing Balance", "amount": 11760000.0},
                ],
            },
        })

        # ── 18. Bharat Payment Receipt — Pidilite advance ──
        await make_invoice(company2, cadmin2, accountant2, {
            "file_name": "Pidilite_Advance_Payment_May2026.pdf",
            "file_type": "application/pdf",
            "invoice_type": InvoiceType.PAYMENT,
            "status": TransactionStatus.ACCEPTED,
            "trust_score": 93.0,
            "days_ago": 4,
            "payment_method": "RTGS",
            "utr_number": "ICIC26050400098871",
            "bank_name": "ICICI Bank",
            "conflicts": [],
            "tx": {
                "vendor_name": "Pidilite Industries Ltd",
                "invoice_number": "PAY-ADV-PIL-2026-051",
                "invoice_date": "2026-05-04",
                "total_amount": 500000.00,
                "currency": "INR",
            },
        })

        # ── 19. Bharat Bank Statement April 2026 ──
        await make_invoice(company2, cadmin2, accountant3, {
            "file_name": "ICICI_BankStatement_Apr2026_Bharat.pdf",
            "file_type": "application/pdf",
            "invoice_type": InvoiceType.BANK_STATEMENT,
            "status": TransactionStatus.ACCEPTED,
            "trust_score": 89.0,
            "days_ago": 12,
            "confidence_scores": {"vendor_name": 0.92, "total_amount": 0.95, "invoice_date": 0.98},
            "conflicts": [],
            "tx": {
                "vendor_name": "ICICI Bank — Current A/C 6282XXXX9901",
                "invoice_date": "2026-04-30",
                "total_amount": 18475200.00,
                "currency": "INR",
            },
        })

        # ── 20. Bharat Salary Register ──
        await make_invoice(company2, cadmin2, accountant3, {
            "file_name": "Salary_Register_Mar2026_Bharat.pdf",
            "file_type": "application/pdf",
            "invoice_type": InvoiceType.SALARY_REGISTER,
            "status": TransactionStatus.ACCEPTED,
            "trust_score": 91.0,
            "days_ago": 65,
            "conflicts": [],
            "tx": {
                "vendor_name": "Bharat Agro Industries Ltd — Payroll",
                "invoice_date": "2026-03-31",
                "total_amount": 945000.00,
                "currency": "INR",
                "line_items": [
                    {"description": "Plant Operations (18 workers)", "quantity": 18, "amount": 540000.0},
                    {"description": "Management & Admin (7 staff)", "quantity": 7, "amount": 280000.0},
                    {"description": "Sales team (5 staff)", "quantity": 5, "amount": 125000.0},
                ],
            },
        })

        await db.flush()

        # ═══════════════════════════════════════════════════════════════
        # MIS REPORTS
        # ═══════════════════════════════════════════════════════════════
        report1 = Report(
            id=uuid.uuid4(),
            company_id=company1.id,
            uploaded_by=accountant1.id,
            title="Q1 2026 MIS Report — Acme Technologies",
            report_type=ReportType.MIS,
            file_name="Acme_Q1_2026_MIS.pdf",
            file_url="https://demo.finbridge.in/reports/acme_q1_2026_mis.pdf",
            description="Quarterly P&L, expense summary by category, GST reconciliation, and cash flow for Jan–Mar 2026.",
            period_start="2026-01-01",
            period_end="2026-03-31",
            created_at=dt(15),
            summary_data={
                "total_spend": 2340000,
                "total_invoices": 9,
                "accepted": 8,
                "rejected": 1,
                "avg_trust_score": 87.4,
                "gst_input_credit": 421200,
                "categories": [
                    {"name": "Cloud Infrastructure", "amount": 1450800, "pct": 62},
                    {"name": "Salaries & Payroll", "amount": 385500, "pct": 16},
                    {"name": "SaaS & Software", "amount": 234000, "pct": 10},
                    {"name": "Office & Rent", "amount": 140400, "pct": 6},
                    {"name": "Logistics & Courier", "amount": 93600, "pct": 4},
                    {"name": "Miscellaneous", "amount": 35700, "pct": 2},
                ],
                "monthly": [
                    {"month": "Jan 2026", "spend": 712000, "invoices": 3},
                    {"month": "Feb 2026", "spend": 845000, "invoices": 3},
                    {"month": "Mar 2026", "spend": 783000, "invoices": 3},
                ],
                "top_vendors": [
                    {"name": "Amazon Web Services", "amount": 924000, "invoices": 2},
                    {"name": "Microsoft Azure", "amount": 526800, "invoices": 1},
                    {"name": "JLL Office Space", "amount": 140400, "invoices": 1},
                    {"name": "Zoho Corporation", "amount": 84960, "invoices": 1},
                    {"name": "Blue Dart Express", "amount": 93600, "invoices": 1},
                ],
                "gst_split": {"cgst": 210600, "sgst": 210600, "igst": 0},
                "cash_flow": {"opening": 5200000, "inflows": 8900000, "outflows": 2340000, "closing": 11760000},
            },
        )
        report2 = Report(
            id=uuid.uuid4(),
            company_id=company1.id,
            uploaded_by=accountant2.id,
            title="April 2026 Monthly MIS — Acme Technologies",
            report_type=ReportType.MIS,
            file_name="Acme_Apr2026_MIS.pdf",
            file_url="https://demo.finbridge.in/reports/acme_apr2026_mis.pdf",
            description="Monthly MIS report: ₹3.9L total spend, cloud infra 62% of opex, salary ₹12.85L processed.",
            period_start="2026-04-01",
            period_end="2026-04-30",
            created_at=dt(3),
            summary_data={
                "total_spend": 390000,
                "total_invoices": 4,
                "accepted": 4,
                "rejected": 0,
                "avg_trust_score": 91.2,
                "gst_input_credit": 70200,
                "categories": [
                    {"name": "Cloud Infrastructure", "amount": 241800, "pct": 62},
                    {"name": "Salaries & Payroll", "amount": 78000, "pct": 20},
                    {"name": "Telecom & Internet", "amount": 46800, "pct": 12},
                    {"name": "Office & Rent", "amount": 23400, "pct": 6},
                ],
                "monthly": [
                    {"month": "Apr 2026", "spend": 390000, "invoices": 4},
                ],
                "top_vendors": [
                    {"name": "Amazon Web Services", "amount": 154080, "invoices": 1},
                    {"name": "Microsoft Azure", "amount": 87720, "invoices": 1},
                    {"name": "Jio Fiber Business", "amount": 46800, "invoices": 1},
                    {"name": "JLL Office Space", "amount": 23400, "invoices": 1},
                ],
                "gst_split": {"cgst": 35100, "sgst": 35100, "igst": 0},
                "cash_flow": {"opening": 11760000, "inflows": 4200000, "outflows": 390000, "closing": 15570000},
                "highlights": [
                    "AWS spend up 8% MoM — new EC2 autoscaling instances provisioned",
                    "Jio Fiber business plan upgraded for 1Gbps connectivity",
                    "Zero rejected invoices — 100% clean month",
                ],
            },
        )
        report3 = Report(
            id=uuid.uuid4(),
            company_id=company2.id,
            uploaded_by=accountant2.id,
            title="Q1 2026 MIS Report — Bharat Agro Industries",
            report_type=ReportType.MIS,
            file_name="BharatAgro_Q1_2026_MIS.pdf",
            file_url="https://demo.finbridge.in/reports/bharat_q1_2026_mis.pdf",
            description="Manufacturing opex analysis: raw materials 68%, logistics 18%, maintenance 14%. GST ITC summary attached.",
            period_start="2026-01-01",
            period_end="2026-03-31",
            created_at=dt(12),
            summary_data={
                "total_spend": 5890000,
                "total_invoices": 4,
                "accepted": 3,
                "rejected": 0,
                "avg_trust_score": 76.0,
                "gst_input_credit": 1060200,
                "categories": [
                    {"name": "Raw Materials", "amount": 4005200, "pct": 68},
                    {"name": "Logistics & Transport", "amount": 1060200, "pct": 18},
                    {"name": "Machinery & Maintenance", "amount": 824600, "pct": 14},
                ],
                "monthly": [
                    {"month": "Jan 2026", "spend": 1840000, "invoices": 2},
                    {"month": "Feb 2026", "spend": 2150000, "invoices": 1},
                    {"month": "Mar 2026", "spend": 1900000, "invoices": 1},
                ],
                "top_vendors": [
                    {"name": "Pidilite Industries", "amount": 3500000, "invoices": 1},
                    {"name": "VRL Logistics", "amount": 1060200, "invoices": 1},
                    {"name": "Kirloskar Electric", "amount": 824600, "invoices": 1},
                    {"name": "State Electricity Board", "amount": 505200, "invoices": 1},
                ],
                "gst_split": {"cgst": 0, "sgst": 0, "igst": 1060200},
                "cash_flow": {"opening": 12000000, "inflows": 18500000, "outflows": 5890000, "closing": 24610000},
                "highlights": [
                    "VRL Logistics flagged for suspicious pricing — 3.2× above market average",
                    "Pidilite raw material procurement within budget for Q1",
                    "IGST-only month — all vendors from outside Gujarat (inter-state)",
                ],
            },
        )
        db.add(report1); db.add(report2); db.add(report3)
        await db.flush()

        # Audit for reports
        for report, actor in [(report1, accountant1), (report2, accountant2), (report3, accountant2)]:
            db.add(AuditLog(
                id=uuid.uuid4(), user_id=actor.id,
                action=AuditAction.REPORT_UPLOADED,
                entity_type="report", entity_id=str(report.id),
                details={"title": report.title},
                created_at=report.created_at,
            ))

        # ═══════════════════════════════════════════════════════════════
        # NOTIFICATIONS
        # ═══════════════════════════════════════════════════════════════
        notifications = [
            # Company admin gets notified of accepted invoices
            Notification(
                id=uuid.uuid4(), recipient_id=cadmin1.id,
                type=NotificationType.INVOICE_ACCEPTED,
                title="Invoice Approved",
                message="AWS_Invoice_May2026.pdf has been approved by Priya Sharma. ₹85,000 cleared.",
                entity_type="invoice", entity_id=str(inv1.id),
                is_read=False, created_at=dt(4),
            ),
            Notification(
                id=uuid.uuid4(), recipient_id=cadmin1.id,
                type=NotificationType.INVOICE_ACCEPTED,
                title="Invoice Approved",
                message="Zoho_CRM_Subscription_May2026.pdf approved by Priya Sharma. ₹44,000 cleared.",
                entity_type="invoice", entity_id=str(inv2.id),
                is_read=False, created_at=dt(3),
            ),
            # Rejection notification
            Notification(
                id=uuid.uuid4(), recipient_id=cadmin1.id,
                type=NotificationType.INVOICE_REJECTED,
                title="Invoice Rejected — Action Required",
                message="JetBrains_License_Apr2026.pdf was rejected. Reason: Wrong billing entity — please re-upload.",
                entity_type="invoice", entity_id=str(inv6.id),
                is_read=False, created_at=dt(9),
            ),
            # Report published notification
            Notification(
                id=uuid.uuid4(), recipient_id=cadmin1.id,
                type=NotificationType.REPORT_PUBLISHED,
                title="New MIS Report Available",
                message="April 2026 Monthly MIS report has been published by Rohit Kulkarni. Review your monthly spend summary.",
                entity_type="report", entity_id=str(report2.id),
                is_read=False, created_at=dt(3),
            ),
            # Accountant gets review-needed notifications
            Notification(
                id=uuid.uuid4(), recipient_id=accountant1.id,
                type=NotificationType.INVOICE_NEEDS_REVIEW,
                title="Invoice Needs Review",
                message="BlueDart_Courier_Apr2026.pdf requires review — 2 conflicts detected, trust score 63/100.",
                entity_type="invoice", entity_id=str(inv4.id),
                is_read=False, created_at=dt(2),
            ),
            Notification(
                id=uuid.uuid4(), recipient_id=accountant1.id,
                type=NotificationType.INVOICE_NEEDS_REVIEW,
                title="High-Risk Invoice Flagged",
                message="Canteen_Bill_Photo_Apr2026.jpg scored 41/100 — 3 conflicts, low image quality. Manual review required.",
                entity_type="invoice", entity_id=str(inv5.id),
                is_read=False, created_at=dt(1),
            ),
            # Read notification (older)
            Notification(
                id=uuid.uuid4(), recipient_id=cadmin1.id,
                type=NotificationType.INVOICE_ACCEPTED,
                title="Invoice Approved",
                message="Azure_Invoice_Apr2026.pdf approved by Priya Sharma. ₹65,000 cleared.",
                entity_type="invoice", entity_id=str(inv7.id),
                is_read=True, created_at=dt(39),
            ),
        ]
        for n in notifications:
            db.add(n)

        await db.commit()

        # ── Print summary ──────────────────────────────────────────────
        print("\n" + "═" * 60)
        print("  ✅  FINBRIDGE SEED COMPLETE")
        print("═" * 60)
        print()
        print("  LOGIN CREDENTIALS")
        print("  ─────────────────────────────────────────────────────")
        print("  Platform Admin   admin@finbridge.com       / admin123")
        print("  Firm Admin       firmadmin@demo.com        / firm123")
        print("  Accountant 1     accountant@demo.com       / acc123   ← Priya Sharma")
        print("  Accountant 2     accountant2@demo.com      / acc123   ← Rohit Kulkarni")
        print("  Accountant 3     accountant3@demo.com      / acc123   ← Sneha Iyer")
        print("  Acme Admin       companyadmin@acme.com     / company123")
        print("  Acme User        user@acme.com             / user123")
        print("  Bharat Admin     companyadmin@bharat.com   / company123")
        print("  Bharat User      user@bharat.com           / user123")
        print()
        print("  DEMO INVOICES (Acme Technologies)")
        print("  ─────────────────────────────────────────────────────")
        print("  1.  AWS Invoice May 2026           94/100  Accepted ✓")
        print("  2.  Zoho CRM Subscription          91/100  Accepted ✓")
        print("  3.  Office Rent Receipt (NEFT)     92/100  Accepted ✓  Payment type")
        print("  4.  Blue Dart Courier              63/100  Under Review  2 conflicts ⚠")
        print("  5.  Canteen Bill (photo)           41/100  Needs Correction  HIGH RISK 🔴")
        print("  6.  JetBrains License              88/100  Rejected ✗  Wrong billing entity")
        print("  7.  Azure Invoice Apr 2026         96/100  Accepted ✓")
        print("  8.  AWS Apr (DUPLICATE of #1)      79/100  Under Review  Duplicate flag 🔁")
        print("  9.  Salary Register April 2026     93/100  Accepted ✓  ₹12.85L")
        print(" 10.  HDFC Bank Statement Mar 2026   87/100  Accepted ✓  Bank statement")
        print(" 11.  Jio Fiber Invoice Mar 2026     90/100  Accepted ✓")
        print(" 12.  Print Vendor (corrected)       71/100  Accepted ✓  Accountant corrected amount")
        print(" 13.  Swiggy Catering (pending)      —       Queued / Processing")
        print()
        print("  DEMO INVOICES (Bharat Agro Industries)")
        print("  ─────────────────────────────────────────────────────")
        print(" 14.  Pidilite Raw Material          89/100  Accepted ✓  ₹3.5L")
        print(" 15.  VRL Logistics (suspicious)     52/100  Under Review  3.2× avg amount 🔴")
        print(" 16.  Kirloskar Machinery AMC        86/100  Accepted ✓")
        print(" 17.  Acme Ledger Q1 2026            95/100  Accepted ✓  Transaction Ledger")
        print(" 18.  Pidilite Advance Payment       93/100  Accepted ✓  RTGS Payment Receipt")
        print(" 19.  ICICI Bank Statement Apr 2026  89/100  Accepted ✓  Bank Statement")
        print(" 20.  Salary Register Mar 2026       91/100  Accepted ✓  ₹9.45L")
        print()
        print("  MIS REPORTS: 3 published")
        print("  NOTIFICATIONS: 7 seeded (3 unread for accountant1, 4 unread for cadmin1)")
        print("═" * 60 + "\n")


asyncio.run(seed())
