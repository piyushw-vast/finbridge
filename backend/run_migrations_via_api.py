"""
Run database migrations via Supabase Management API (no direct PG connection needed).
This creates all tables using the service role key.
"""
import httpx
import json

SUPABASE_URL = "https://oafsrjypltbvnathblna.supabase.co"
# service_role key
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hZnNyanlwbHRidm5hdGhibG5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgzNjIzNSwiZXhwIjoyMDk0NDEyMjM1fQ.W1AhFayHC2IRVnDIKw0Ke3GgJiV50A4x8uni2JlDejs"

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}

SQL = """
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- accounting_firms
CREATE TABLE IF NOT EXISTS accounting_firms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_accounting_firms_slug ON accounting_firms(slug);

-- userrole enum
DO $$ BEGIN
    CREATE TYPE userrole AS ENUM ('platform_admin', 'firm_admin', 'company_admin', 'company_user', 'accountant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- businesstype enum
DO $$ BEGIN
    CREATE TYPE businesstype AS ENUM ('manufacturing', 'it', 'services', 'trading', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- invoicetype enum
DO $$ BEGIN
    CREATE TYPE invoicetype AS ENUM ('purchase', 'sales', 'payment', 'salary_register', 'bank_statement', 'ledger');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- transactionstatus enum
DO $$ BEGIN
    CREATE TYPE transactionstatus AS ENUM ('pending', 'under_review', 'needs_correction', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- users (without company FK first)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role userrole NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    firm_id UUID REFERENCES accounting_firms(id),
    company_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_users_email ON users(email);

-- companies
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES accounting_firms(id),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    gst_number VARCHAR(20),
    pan_number VARCHAR(20),
    address TEXT,
    business_type businesstype DEFAULT 'other',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_companies_slug ON companies(slug);

-- Add FK from users to companies
DO $$ BEGIN
    ALTER TABLE users ADD CONSTRAINT fk_users_company_id FOREIGN KEY (company_id) REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- payment_heads
CREATE TABLE IF NOT EXISTS payment_heads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- payment_sub_heads
CREATE TABLE IF NOT EXISTS payment_sub_heads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    head_id UUID NOT NULL REFERENCES payment_heads(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- invoices
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    uploaded_by UUID NOT NULL REFERENCES users(id),
    file_name VARCHAR(500) NOT NULL,
    file_url VARCHAR(1000) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    invoice_type invoicetype DEFAULT 'purchase',
    raw_ocr_text TEXT,
    extraction_data JSONB,
    trust_score FLOAT,
    confidence_scores JSONB,
    conflicts JSONB,
    status transactionstatus DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id),
    reviewer_notes TEXT,
    reviewed_at TIMESTAMP,
    embedding_id VARCHAR(255),
    duplicate_of UUID REFERENCES invoices(id),
    duplicate_score FLOAT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- extracted_transactions
CREATE TABLE IF NOT EXISTS extracted_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL UNIQUE REFERENCES invoices(id),
    company_id UUID NOT NULL REFERENCES companies(id),
    vendor_name VARCHAR(500),
    vendor_gst VARCHAR(20),
    invoice_number VARCHAR(100),
    invoice_date VARCHAR(50),
    due_date VARCHAR(50),
    subtotal FLOAT,
    tax_amount FLOAT,
    total_amount FLOAT,
    currency VARCHAR(10) DEFAULT 'INR',
    line_items JSONB,
    payment_head_id UUID REFERENCES payment_heads(id),
    corrected_data JSONB,
    is_corrected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- invoice_embeddings
CREATE TABLE IF NOT EXISTS invoice_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL UNIQUE REFERENCES invoices(id),
    company_id UUID NOT NULL REFERENCES companies(id),
    embedding TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- notificationtype enum
DO $$ BEGIN
    CREATE TYPE notificationtype AS ENUM ('invoice_uploaded', 'invoice_accepted', 'invoice_rejected', 'invoice_needs_review', 'report_published', 'general');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users(id),
    type notificationtype NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(255),
    is_read BOOLEAN DEFAULT FALSE,
    extra_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- auditaction enum
DO $$ BEGIN
    CREATE TYPE auditaction AS ENUM ('invoice_uploaded', 'invoice_extracted', 'invoice_accepted', 'invoice_rejected', 'invoice_correction_submitted', 'report_uploaded', 'user_login', 'user_created', 'company_created', 'firm_created');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action auditaction NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(255),
    user_id UUID REFERENCES users(id),
    details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- reporttype enum
DO $$ BEGIN
    CREATE TYPE reporttype AS ENUM ('mis', 'balance_sheet', 'profit_loss', 'cash_flow', 'gst_summary', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- reports
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES accounting_firms(id),
    company_id UUID REFERENCES companies(id),
    uploaded_by UUID NOT NULL REFERENCES users(id),
    type reporttype NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_path VARCHAR(500),
    file_name VARCHAR(255),
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- alembic version tracking
CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL PRIMARY KEY
);
INSERT INTO alembic_version (version_num) VALUES ('002') ON CONFLICT DO NOTHING;
"""


def run_sql(sql: str, label: str = ""):
    resp = httpx.post(
        f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
        headers=headers,
        json={"query": sql},
        timeout=30,
    )
    if resp.status_code != 200:
        # Try alternative endpoint
        return None
    return resp.json()


def run_via_pg_meta(sql: str):
    """Use the pg meta API which Supabase exposes for their dashboard."""
    resp = httpx.post(
        f"{SUPABASE_URL}/pg/query",
        headers={**headers, "Content-Type": "application/json"},
        json={"query": sql},
        timeout=60,
    )
    return resp.status_code, resp.text[:500]


if __name__ == "__main__":
    print("Running migrations via Supabase API...")

    # Try using PostgREST RPC - need a custom function
    # Instead use the Supabase Management API
    PROJECT_REF = "oafsrjypltbvnathblna"
    MANAGEMENT_KEY = SERVICE_KEY  # service role key

    resp = httpx.post(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
        headers={
            "Authorization": f"Bearer {MANAGEMENT_KEY}",
            "Content-Type": "application/json",
        },
        json={"query": "SELECT 1"},
        timeout=30,
    )
    print(f"Management API test: {resp.status_code} - {resp.text[:200]}")

    if resp.status_code == 200:
        print("Management API works! Running full migration...")
        resp2 = httpx.post(
            f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
            headers={
                "Authorization": f"Bearer {MANAGEMENT_KEY}",
                "Content-Type": "application/json",
            },
            json={"query": SQL},
            timeout=120,
        )
        print(f"Migration result: {resp2.status_code}")
        print(resp2.text[:1000])
    else:
        print("\nManagement API requires separate auth token.")
        print("Please run migrations manually via Supabase SQL Editor:")
        print("1. Go to https://supabase.com/dashboard/project/oafsrjypltbvnathblna/sql/new")
        print("2. Paste the SQL from the file and run it")
        print("\nSaving SQL to /tmp/finbridge_migrations.sql...")
        with open("/tmp/finbridge_migrations.sql", "w") as f:
            f.write(SQL)
        print("SQL saved to /tmp/finbridge_migrations.sql")
