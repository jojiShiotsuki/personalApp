"""make nurture prospect_id campaign_id nullable

Revision ID: fd5d14b3f0bb
Revises: 357e1bc4fc3c
Create Date: 2026-04-05 15:53:46.438300

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fd5d14b3f0bb'
down_revision: Union[str, None] = '357e1bc4fc3c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('nurture_leads', 'prospect_id', existing_type=sa.Integer(), nullable=True)
    op.alter_column('nurture_leads', 'campaign_id', existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    op.alter_column('nurture_leads', 'prospect_id', existing_type=sa.Integer(), nullable=False)
    op.alter_column('nurture_leads', 'campaign_id', existing_type=sa.Integer(), nullable=False)
