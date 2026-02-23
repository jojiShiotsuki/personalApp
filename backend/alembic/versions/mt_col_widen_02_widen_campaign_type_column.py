"""widen campaign_type column for MULTI_TOUCH

Revision ID: mt_col_widen_02
Revises: mt_enum_vals_01
Create Date: 2026-02-23 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
from alembic import context
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'mt_col_widen_02'
down_revision: Union[str, None] = 'mt_enum_vals_01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Only needed for PostgreSQL - SQLite doesn't enforce varchar length
    if context.get_context().dialect.name == 'postgresql':
        op.alter_column(
            'outreach_campaigns',
            'campaign_type',
            type_=sa.String(20),
            existing_nullable=False,
        )


def downgrade() -> None:
    if context.get_context().dialect.name == 'postgresql':
        op.alter_column(
            'outreach_campaigns',
            'campaign_type',
            type_=sa.String(10),
            existing_nullable=False,
        )
