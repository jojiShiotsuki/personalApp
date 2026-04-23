"""add follow_up fields to call_prospects

Adds follow_up_on (nullable Date) and follow_up_notes (nullable String(255))
for the Cold Calls follow-up tracking feature. Date-only semantics — distinct
from callback_at which is a DateTime. Includes an index on follow_up_on to
keep the "Follow-ups Due" count + kanban filter cheap.

Revision ID: follow_up_2026_04_23
Revises: tier_2026_04_22
Create Date: 2026-04-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "follow_up_2026_04_23"
down_revision: Union[str, None] = "tier_2026_04_22"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'call_prospects',
        sa.Column('follow_up_on', sa.Date(), nullable=True),
    )
    op.add_column(
        'call_prospects',
        sa.Column('follow_up_notes', sa.String(length=255), nullable=True),
    )
    op.create_index(
        'ix_call_prospects_follow_up_on',
        'call_prospects',
        ['follow_up_on'],
        unique=False,
    )


def downgrade() -> None:
    with op.batch_alter_table('call_prospects', schema=None) as batch_op:
        batch_op.drop_index('ix_call_prospects_follow_up_on')
        batch_op.drop_column('follow_up_notes')
        batch_op.drop_column('follow_up_on')
