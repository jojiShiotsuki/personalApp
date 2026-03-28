"""add linkedin_followup_count to outreach_prospects

Revision ID: li_followup_01
Revises: cta_angle_01
Create Date: 2026-03-28
"""
from alembic import op
import sqlalchemy as sa

revision = 'li_followup_01'
down_revision = 'cta_angle_01'
branch_labels = None
depends_on = None


def _column_exists(table, column):
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [c['name'] for c in inspector.get_columns(table)]
    return column in columns


def upgrade():
    if not _column_exists('outreach_prospects', 'linkedin_followup_count'):
        op.add_column('outreach_prospects', sa.Column('linkedin_followup_count', sa.Integer(), server_default='0', nullable=True))


def downgrade():
    if _column_exists('outreach_prospects', 'linkedin_followup_count'):
        op.drop_column('outreach_prospects', 'linkedin_followup_count')
