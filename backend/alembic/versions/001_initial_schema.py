"""initial schema

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # accounting_firms
    op.create_table(
        'accounting_firms',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(255), nullable=False, unique=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('address', sa.Text, nullable=True),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )
    op.create_index('ix_accounting_firms_slug', 'accounting_firms', ['slug'])

    # users
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('role', sa.Enum(
            'platform_admin', 'firm_admin', 'company_admin', 'company_user', 'accountant',
            name='userrole'
        ), nullable=False),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('firm_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('accounting_firms.id'), nullable=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )
    op.create_index('ix_users_email', 'users', ['email'])

    # companies
    op.create_table(
        'companies',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('firm_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('accounting_firms.id'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(255), nullable=False, unique=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('gst_number', sa.String(20), nullable=True),
        sa.Column('pan_number', sa.String(20), nullable=True),
        sa.Column('address', sa.Text, nullable=True),
        sa.Column('business_type', sa.Enum(
            'manufacturing', 'it', 'services', 'trading', 'other',
            name='businesstype'
        ), default='other'),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )
    op.create_index('ix_companies_slug', 'companies', ['slug'])

    # Add FK from users to companies
    op.create_foreign_key('fk_users_company_id', 'users', 'companies', ['company_id'], ['id'])

    # payment_heads
    op.create_table(
        'payment_heads',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
    )

    # payment_sub_heads
    op.create_table(
        'payment_sub_heads',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('head_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('payment_heads.id'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
    )

    # invoices
    op.create_table(
        'invoices',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('uploaded_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('file_name', sa.String(500), nullable=False),
        sa.Column('file_url', sa.String(1000), nullable=False),
        sa.Column('file_type', sa.String(50), nullable=False),
        sa.Column('invoice_type', sa.Enum(
            'purchase', 'sales', 'payment', 'salary_register', 'bank_statement', 'ledger',
            name='invoicetype'
        ), default='purchase'),
        sa.Column('raw_ocr_text', sa.Text, nullable=True),
        sa.Column('extraction_data', postgresql.JSON, nullable=True),
        sa.Column('trust_score', sa.Float, nullable=True),
        sa.Column('confidence_scores', postgresql.JSON, nullable=True),
        sa.Column('conflicts', postgresql.JSON, nullable=True),
        sa.Column('status', sa.Enum(
            'pending', 'under_review', 'needs_correction', 'accepted', 'rejected',
            name='transactionstatus'
        ), default='pending'),
        sa.Column('reviewed_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('reviewer_notes', sa.Text, nullable=True),
        sa.Column('reviewed_at', sa.DateTime, nullable=True),
        sa.Column('embedding_id', sa.String(255), nullable=True),
        sa.Column('duplicate_of', postgresql.UUID(as_uuid=True), sa.ForeignKey('invoices.id'), nullable=True),
        sa.Column('duplicate_score', sa.Float, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )

    # extracted_transactions
    op.create_table(
        'extracted_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('invoice_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('invoices.id'), nullable=False, unique=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('vendor_name', sa.String(500), nullable=True),
        sa.Column('vendor_gst', sa.String(20), nullable=True),
        sa.Column('invoice_number', sa.String(100), nullable=True),
        sa.Column('invoice_date', sa.String(50), nullable=True),
        sa.Column('due_date', sa.String(50), nullable=True),
        sa.Column('subtotal', sa.Float, nullable=True),
        sa.Column('tax_amount', sa.Float, nullable=True),
        sa.Column('total_amount', sa.Float, nullable=True),
        sa.Column('currency', sa.String(10), default='INR'),
        sa.Column('line_items', postgresql.JSON, nullable=True),
        sa.Column('payment_head_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('payment_heads.id'), nullable=True),
        sa.Column('corrected_data', postgresql.JSON, nullable=True),
        sa.Column('is_corrected', sa.Boolean, default=False),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )

    # invoice embeddings table for pgvector duplicate detection
    op.create_table(
        'invoice_embeddings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('invoice_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('invoices.id'), nullable=False, unique=True),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('embedding', sa.Text, nullable=True),  # stored as text, queried via pgvector
        sa.Column('created_at', sa.DateTime, nullable=False),
    )


def downgrade() -> None:
    op.drop_table('invoice_embeddings')
    op.drop_table('extracted_transactions')
    op.drop_table('invoices')
    op.drop_table('payment_sub_heads')
    op.drop_table('payment_heads')
    op.drop_constraint('fk_users_company_id', 'users', type_='foreignkey')
    op.drop_table('companies')
    op.drop_table('users')
    op.drop_table('accounting_firms')
    op.execute("DROP TYPE IF EXISTS userrole")
    op.execute("DROP TYPE IF EXISTS businesstype")
    op.execute("DROP TYPE IF EXISTS invoicetype")
    op.execute("DROP TYPE IF EXISTS transactionstatus")
