"""add prospect link columns

Revision ID: 13a052f682b9
Revises: l8m9n0o1p2q3
Create Date: 2026-02-10 16:38:39.716721

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '13a052f682b9'
down_revision: Union[str, None] = 'l8m9n0o1p2q3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('outreach_prospects', sa.Column('discovered_lead_id', sa.Integer(), nullable=True))
    op.add_column('outreach_prospects', sa.Column('converted_contact_id', sa.Integer(), nullable=True))
    op.add_column('outreach_prospects', sa.Column('converted_deal_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('outreach_prospects', 'converted_deal_id')
    op.drop_column('outreach_prospects', 'converted_contact_id')
    op.drop_column('outreach_prospects', 'discovered_lead_id')
