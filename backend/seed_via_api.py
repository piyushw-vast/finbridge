"""
Seed data via Supabase REST API (PostgREST) — no direct DB connection needed.
"""
import httpx
import uuid
from datetime import datetime, timedelta
from passlib.context import CryptContext

SUPABASE_URL = "https://oafsrjypltbvnathblna.supabase.co"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZnNyanlwbHRidm5hdGhibG5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgzNjIzNSwiZXhwIjoyMDk0NDEyMjM1fQ.W1AhFayHC2IRVnDIKw0Ke3GgJiV50A4x8uni2JlDejs"

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def h(pw: str) -> str:
    return pwd_ctx.hash(pw)


def now():
    return datetime.utcnow().isoformat()


def insert(table: str, data: dict) -> dict:
    resp = httpx.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        headers=headers,
        json=data,
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        print(f"  ERROR inserting into {table}: {resp.status_code} - {resp.text[:300]}")
        return {}
    result = resp.json()
    return result[0] if isinstance(result, list) else result


def main():
    print("Seeding FinBridge demo data...\n")

    # IDs
    firm_id = str(uuid.uuid4())
    admin_id = str(uuid.uuid4())
    firm_admin_id = str(uuid.uuid4())
    accountant_id = str(uuid.uuid4())
    acme_id = str(uuid.uuid4())
    bharat_id = str(uuid.uuid4())
    acme_admin_id = str(uuid.uuid4())
    acme_user_id = str(uuid.uuid4())

    # 1. Accounting firm
    print("Creating accounting firm...")
    insert("accounting_firms", {
        "id": firm_id,
        "name": "Sharma & Associates",
        "slug": "sharma-associates",
        "email": "contact@sharma-associates.com",
        "phone": "+91-9876543210",
        "address": "123, Connaught Place, New Delhi - 110001",
        "is_active": True,
        "created_at": now(),
        "updated_at": now(),
    })

    # 2. Platform admin
    print("Creating platform admin...")
    insert("users", {
        "id": admin_id,
        "email": "admin@finbridge.com",
        "hashed_password": h("admin123"),
        "full_name": "Platform Administrator",
        "role": "platform_admin",
        "is_active": True,
        "created_at": now(),
        "updated_at": now(),
    })

    # 3. Firm admin
    print("Creating firm admin...")
    insert("users", {
        "id": firm_admin_id,
        "email": "firmadmin@demo.com",
        "hashed_password": h("firm123"),
        "full_name": "Rajesh Sharma",
        "role": "firm_admin",
        "is_active": True,
        "firm_id": firm_id,
        "created_at": now(),
        "updated_at": now(),
    })

    # 4. Accountant
    print("Creating accountant...")
    insert("users", {
        "id": accountant_id,
        "email": "accountant@demo.com",
        "hashed_password": h("acc123"),
        "full_name": "Priya Mehta",
        "role": "accountant",
        "is_active": True,
        "firm_id": firm_id,
        "created_at": now(),
        "updated_at": now(),
    })

    # 5. Companies
    print("Creating companies...")
    insert("companies", {
        "id": acme_id,
        "firm_id": firm_id,
        "name": "Acme IT Solutions Pvt Ltd",
        "slug": "acme-it-solutions",
        "email": "accounts@acmeit.com",
        "phone": "+91-9876500001",
        "gst_number": "27AABCU9603R1ZX",
        "pan_number": "AABCU9603R",
        "address": "Tower B, Cybercity, Pune - 411014",
        "business_type": "it",
        "is_active": True,
        "created_at": now(),
        "updated_at": now(),
    })
    insert("companies", {
        "id": bharat_id,
        "firm_id": firm_id,
        "name": "Bharat Manufacturing Co",
        "slug": "bharat-manufacturing",
        "email": "finance@bharatmfg.com",
        "phone": "+91-9876500002",
        "gst_number": "27AABCB1234M1ZY",
        "pan_number": "AABCB1234M",
        "address": "Plot 45, MIDC Industrial Area, Nashik - 422010",
        "business_type": "manufacturing",
        "is_active": True,
        "created_at": now(),
        "updated_at": now(),
    })

    # 6. Company users
    print("Creating company users...")
    insert("users", {
        "id": acme_admin_id,
        "email": "companyadmin@acme.com",
        "hashed_password": h("company123"),
        "full_name": "Amit Kumar",
        "role": "company_admin",
        "is_active": True,
        "firm_id": firm_id,
        "company_id": acme_id,
        "created_at": now(),
        "updated_at": now(),
    })
    insert("users", {
        "id": acme_user_id,
        "email": "user@acme.com",
        "hashed_password": h("user123"),
        "full_name": "Sneha Patel",
        "role": "company_user",
        "is_active": True,
        "firm_id": firm_id,
        "company_id": acme_id,
        "created_at": now(),
        "updated_at": now(),
    })

    # 7. Payment heads for Acme (IT)
    print("Creating payment heads...")
    heads_data = [
        ("Payroll", ["Salaries", "Bonuses", "Benefits"]),
        ("Software & Licenses", ["SaaS Subscriptions", "Development Tools", "Cloud Services"]),
        ("Infrastructure", ["Servers", "Networking", "Security"]),
        ("Marketing", ["Digital Ads", "Events", "PR"]),
        ("G&A", ["Office Rent", "Legal", "Accounting"]),
    ]
    for head_name, sub_names in heads_data:
        head_id = str(uuid.uuid4())
        insert("payment_heads", {
            "id": head_id,
            "company_id": acme_id,
            "name": head_name,
            "is_active": True,
            "created_at": now(),
        })
        for sub_name in sub_names:
            insert("payment_sub_heads", {
                "id": str(uuid.uuid4()),
                "head_id": head_id,
                "name": sub_name,
                "is_active": True,
                "created_at": now(),
            })

    # 8. Demo invoices
    print("Creating demo invoices...")
    base_time = datetime.utcnow()

    # Invoice 1: AWS Cloud Invoice — trust 94, accepted
    inv1_id = str(uuid.uuid4())
    insert("invoices", {
        "id": inv1_id,
        "company_id": acme_id,
        "uploaded_by": acme_admin_id,
        "file_name": "aws_cloud_invoice_march_2024.pdf",
        "file_url": "https://oafsrjypltbvnathblna.supabase.co/storage/v1/object/public/invoices/demo/aws_invoice.pdf",
        "file_type": "pdf",
        "invoice_type": "purchase",
        "trust_score": 94.2,
        "status": "accepted",
        "reviewed_by": accountant_id,
        "reviewer_notes": "Verified. All fields match PO #2024-AWS-001.",
        "reviewed_at": (base_time - timedelta(days=1)).isoformat(),
        "extraction_data": {
            "processing_status": "complete",
            "vendor_name": "Amazon Web Services India Pvt Ltd",
            "vendor_gst": "29AAQCA4519Q1ZX",
            "invoice_number": "IN-AWS-2024-03-001",
            "invoice_date": "2024-03-31",
            "subtotal": 45230.50,
            "tax_amount": 8141.49,
            "total_amount": 53371.99,
            "currency": "INR",
        },
        "confidence_scores": {
            "vendor_name": 0.97,
            "vendor_gst": 0.99,
            "invoice_number": 0.96,
            "invoice_date": 0.98,
            "total_amount": 0.95,
        },
        "conflicts": [],
        "created_at": (base_time - timedelta(days=3)).isoformat(),
        "updated_at": (base_time - timedelta(days=1)).isoformat(),
    })
    insert("extracted_transactions", {
        "id": str(uuid.uuid4()),
        "invoice_id": inv1_id,
        "company_id": acme_id,
        "vendor_name": "Amazon Web Services India Pvt Ltd",
        "vendor_gst": "29AAQCA4519Q1ZX",
        "invoice_number": "IN-AWS-2024-03-001",
        "invoice_date": "2024-03-31",
        "subtotal": 45230.50,
        "tax_amount": 8141.49,
        "total_amount": 53371.99,
        "currency": "INR",
        "line_items": [
            {"description": "EC2 Instances (t3.medium × 5)", "quantity": 1, "amount": 18500.00},
            {"description": "S3 Storage (2TB)", "quantity": 1, "amount": 12300.00},
            {"description": "CloudFront CDN", "quantity": 1, "amount": 8200.00},
            {"description": "RDS PostgreSQL", "quantity": 1, "amount": 6230.50},
        ],
        "created_at": (base_time - timedelta(days=3)).isoformat(),
        "updated_at": (base_time - timedelta(days=1)).isoformat(),
    })

    # Invoice 2: Blurry vendor bill — trust 61, under review
    inv2_id = str(uuid.uuid4())
    insert("invoices", {
        "id": inv2_id,
        "company_id": acme_id,
        "uploaded_by": acme_user_id,
        "file_name": "vendor_bill_feb_blurry.jpg",
        "file_url": "https://oafsrjypltbvnathblna.supabase.co/storage/v1/object/public/invoices/demo/blurry_bill.jpg",
        "file_type": "jpg",
        "invoice_type": "purchase",
        "trust_score": 61.5,
        "status": "under_review",
        "extraction_data": {
            "processing_status": "complete",
            "vendor_name": "Infosys BPO Limited",
            "vendor_gst": "29AACI1234M1Z5",
            "invoice_number": "IBP-2024-0234",
            "invoice_date": "2024-02-28",
            "subtotal": 125000.00,
            "tax_amount": 22500.00,
            "total_amount": 147500.00,
            "currency": "INR",
        },
        "confidence_scores": {
            "vendor_name": 0.72,
            "vendor_gst": 0.58,
            "invoice_number": 0.65,
            "invoice_date": 0.78,
            "total_amount": 0.61,
        },
        "conflicts": [
            {"field": "vendor_gst", "extractors": ["claude", "ocr"], "values": ["29AACI1234M1Z5", "29AAOI1234M1Z5"], "severity": "medium"},
        ],
        "created_at": (base_time - timedelta(hours=12)).isoformat(),
        "updated_at": (base_time - timedelta(hours=12)).isoformat(),
    })
    insert("extracted_transactions", {
        "id": str(uuid.uuid4()),
        "invoice_id": inv2_id,
        "company_id": acme_id,
        "vendor_name": "Infosys BPO Limited",
        "vendor_gst": "29AACI1234M1Z5",
        "invoice_number": "IBP-2024-0234",
        "invoice_date": "2024-02-28",
        "subtotal": 125000.00,
        "tax_amount": 22500.00,
        "total_amount": 147500.00,
        "currency": "INR",
        "line_items": [
            {"description": "IT Support Services - February 2024", "quantity": 1, "amount": 125000.00},
        ],
        "created_at": (base_time - timedelta(hours=12)).isoformat(),
        "updated_at": (base_time - timedelta(hours=12)).isoformat(),
    })

    # Invoice 3: WhatsApp photo — trust 43, needs correction
    inv3_id = str(uuid.uuid4())
    insert("invoices", {
        "id": inv3_id,
        "company_id": acme_id,
        "uploaded_by": acme_user_id,
        "file_name": "photo_whatsapp_receipt.jpg",
        "file_url": "https://oafsrjypltbvnathblna.supabase.co/storage/v1/object/public/invoices/demo/whatsapp_photo.jpg",
        "file_type": "jpg",
        "invoice_type": "purchase",
        "trust_score": 43.0,
        "status": "needs_correction",
        "extraction_data": {
            "processing_status": "complete",
            "vendor_name": "Priya Stationery Mart",
            "vendor_gst": None,
            "invoice_number": "PSM-441",
            "invoice_date": "2024-03-15",
            "subtotal": 4200.00,
            "tax_amount": None,
            "total_amount": 4200.00,
            "currency": "INR",
        },
        "confidence_scores": {
            "vendor_name": 0.55,
            "vendor_gst": 0.10,
            "invoice_number": 0.48,
            "invoice_date": 0.60,
            "total_amount": 0.52,
        },
        "conflicts": [
            {"field": "invoice_number", "extractors": ["claude", "donut"], "values": ["PSM-441", "PSM-447"], "severity": "high"},
            {"field": "total_amount", "extractors": ["claude", "ocr"], "values": [4200.00, 4700.00], "severity": "high"},
        ],
        "created_at": (base_time - timedelta(hours=2)).isoformat(),
        "updated_at": (base_time - timedelta(hours=2)).isoformat(),
    })
    insert("extracted_transactions", {
        "id": str(uuid.uuid4()),
        "invoice_id": inv3_id,
        "company_id": acme_id,
        "vendor_name": "Priya Stationery Mart",
        "invoice_number": "PSM-441",
        "invoice_date": "2024-03-15",
        "subtotal": 4200.00,
        "total_amount": 4200.00,
        "currency": "INR",
        "line_items": [
            {"description": "Office Stationery (bulk)", "quantity": 1, "amount": 4200.00},
        ],
        "created_at": (base_time - timedelta(hours=2)).isoformat(),
        "updated_at": (base_time - timedelta(hours=2)).isoformat(),
    })

    # Invoice 4: Salary register — trust 89, accepted
    inv4_id = str(uuid.uuid4())
    insert("invoices", {
        "id": inv4_id,
        "company_id": acme_id,
        "uploaded_by": acme_admin_id,
        "file_name": "salary_register_march_2024.pdf",
        "file_url": "https://oafsrjypltbvnathblna.supabase.co/storage/v1/object/public/invoices/demo/salary_register.pdf",
        "file_type": "pdf",
        "invoice_type": "salary_register",
        "trust_score": 89.1,
        "status": "accepted",
        "reviewed_by": accountant_id,
        "reviewer_notes": "March payroll confirmed.",
        "reviewed_at": (base_time - timedelta(hours=6)).isoformat(),
        "extraction_data": {
            "processing_status": "complete",
            "vendor_name": "Acme IT Solutions Pvt Ltd (Payroll)",
            "invoice_number": "SAL-2024-03",
            "invoice_date": "2024-03-31",
            "subtotal": 850000.00,
            "tax_amount": 0.00,
            "total_amount": 850000.00,
            "currency": "INR",
        },
        "confidence_scores": {
            "vendor_name": 0.92,
            "invoice_number": 0.90,
            "invoice_date": 0.95,
            "total_amount": 0.88,
        },
        "conflicts": [],
        "created_at": (base_time - timedelta(days=2)).isoformat(),
        "updated_at": (base_time - timedelta(hours=6)).isoformat(),
    })
    insert("extracted_transactions", {
        "id": str(uuid.uuid4()),
        "invoice_id": inv4_id,
        "company_id": acme_id,
        "vendor_name": "Acme IT Solutions Pvt Ltd (Payroll)",
        "invoice_number": "SAL-2024-03",
        "invoice_date": "2024-03-31",
        "subtotal": 850000.00,
        "tax_amount": 0.00,
        "total_amount": 850000.00,
        "currency": "INR",
        "line_items": [
            {"description": "Engineering Team (12 staff)", "quantity": 12, "amount": 480000.00},
            {"description": "Sales Team (5 staff)", "quantity": 5, "amount": 200000.00},
            {"description": "Management (3 staff)", "quantity": 3, "amount": 170000.00},
        ],
        "created_at": (base_time - timedelta(days=2)).isoformat(),
        "updated_at": (base_time - timedelta(hours=6)).isoformat(),
    })

    # 9. Notifications
    print("Creating notifications...")
    insert("notifications", {
        "id": str(uuid.uuid4()),
        "recipient_id": accountant_id,
        "type": "invoice_needs_review",
        "title": "New Invoice for Review",
        "message": "A new invoice from Acme IT Solutions needs review. Trust Score: 62/100",
        "entity_type": "invoice",
        "entity_id": inv2_id,
        "is_read": False,
        "extra_data": {"trust_score": 61.5},
        "created_at": (base_time - timedelta(hours=12)).isoformat(),
    })
    insert("notifications", {
        "id": str(uuid.uuid4()),
        "recipient_id": accountant_id,
        "type": "invoice_needs_review",
        "title": "Low-Trust Invoice Flagged",
        "message": "Invoice from Priya Stationery Mart has multiple conflicts. Trust Score: 43/100 — needs correction.",
        "entity_type": "invoice",
        "entity_id": inv3_id,
        "is_read": False,
        "extra_data": {"trust_score": 43.0},
        "created_at": (base_time - timedelta(hours=2)).isoformat(),
    })
    insert("notifications", {
        "id": str(uuid.uuid4()),
        "recipient_id": acme_admin_id,
        "type": "invoice_accepted",
        "title": "Invoice Accepted",
        "message": "Your invoice (AWS Cloud Invoice) has been accepted by Priya Mehta.",
        "entity_type": "invoice",
        "entity_id": inv1_id,
        "is_read": True,
        "created_at": (base_time - timedelta(days=1)).isoformat(),
    })

    print("\n✓ Seed data loaded successfully!")
    print("\nLogin credentials:")
    print("  Platform Admin  : admin@finbridge.com / admin123")
    print("  Firm Admin      : firmadmin@demo.com / firm123")
    print("  Accountant      : accountant@demo.com / acc123")
    print("  Company Admin   : companyadmin@acme.com / company123")
    print("  Company User    : user@acme.com / user123")


if __name__ == "__main__":
    main()
