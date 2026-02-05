"""add outreach tracking fields to contacts

Revision ID: 582cc026c1fd
Revises: b22a8df02666
Create Date: 2026-02-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '582cc026c1fd'
down_revision: Union[str, None] = 'b22a8df02666'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add outreach tracking fields to contacts table
    op.add_column('crm_contacts', sa.Column('email_stage', sa.String(length=50), nullable=True))
    op.add_column('crm_contacts', sa.Column('email_last_sent', sa.Date(), nullable=True))
    op.add_column('crm_contacts', sa.Column('linkedin_stage', sa.String(length=50), nullable=True))
    op.add_column('crm_contacts', sa.Column('linkedin_last_action', sa.Date(), nullable=True))
    op.add_column('crm_contacts', sa.Column('loom_audit_sent', sa.Boolean(), nullable=True))
    op.add_column('crm_contacts', sa.Column('loom_audit_url', sa.String(length=500), nullable=True))
    op.add_column('crm_contacts', sa.Column('next_followup_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('crm_contacts', 'next_followup_date')
    op.drop_column('crm_contacts', 'loom_audit_url')
    op.drop_column('crm_contacts', 'loom_audit_sent')
    op.drop_column('crm_contacts', 'linkedin_last_action')
    op.drop_column('crm_contacts', 'linkedin_stage')
    op.drop_column('crm_contacts', 'email_last_sent')
    op.drop_column('crm_contacts', 'email_stage')
