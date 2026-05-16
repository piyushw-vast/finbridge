"""add summary_data to reports

Revision ID: 003_add_report_summary_data
Revises: fbbc8bbaf61a
Create Date: 2026-05-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '003_add_report_summary_data'
down_revision = 'fbbc8bbaf61a'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('reports', sa.Column('summary_data', JSONB, nullable=True))


def downgrade():
    op.drop_column('reports', 'summary_data')
