"""add notifications audit reports

Revision ID: 002
Revises: 001
Create Date: 2026-05-15 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('recipient_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('type', sa.Enum(
            'invoice_uploaded', 'invoice_accepted', 'invoice_rejected',
            'invoice_needs_review', 'report_published', 'general',
            name='notificationtype'
        ), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('message', sa.Text, nullable=False),
        sa.Column('entity_type', sa.String(100), nullable=True),
        sa.Column('entity_id', sa.String(255), nullable=True),
        sa.Column('is_read', sa.Boolean, default=False),
        sa.Column('extra_data', sa.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
    )

    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('action', sa.Enum(
            'invoice_uploaded', 'invoice_extracted', 'invoice_accepted', 'invoice_rejected',
            'invoice_correction_submitted', 'report_uploaded', 'user_login', 'user_created',
            'company_created', 'firm_created',
            name='auditaction'
        ), nullable=False),
        sa.Column('entity_type', sa.String(100), nullable=True),
        sa.Column('entity_id', sa.String(255), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('details', sa.JSON, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False),
    )

    op.create_table(
        'reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('firm_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('accounting_firms.id'), nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('companies.id'), nullable=True),
        sa.Column('uploaded_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('type', sa.Enum(
            'mis', 'balance_sheet', 'profit_loss', 'cash_flow', 'gst_summary', 'custom',
            name='reporttype'
        ), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('file_path', sa.String(500), nullable=True),
        sa.Column('file_name', sa.String(255), nullable=True),
        sa.Column('period_start', sa.DateTime, nullable=True),
        sa.Column('period_end', sa.DateTime, nullable=True),
        sa.Column('is_published', sa.Boolean, default=False),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False),
    )


def downgrade() -> None:
    op.drop_table('reports')
    op.drop_table('audit_logs')
    op.drop_table('notifications')
    op.execute("DROP TYPE IF EXISTS reporttype")
    op.execute("DROP TYPE IF EXISTS auditaction")
    op.execute("DROP TYPE IF EXISTS notificationtype")
