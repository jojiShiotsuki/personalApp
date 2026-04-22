"""add callback fields to call_prospects

Adds callback_at (nullable DateTime) and callback_notes (nullable String(255))
for the Cold Calls callback-tracking feature. Includes an index on callback_at
to keep the "Callbacks Due" count + kanban filter cheap.

Revision ID: cb_tracking_2026_04_22
Revises: scr_label_2026_04_21
Create Date: 2026-04-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "cb_tracking_2026_04_22"
down_revision: Union[str, None] = "scr_label_2026_04_21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'call_prospects',
        sa.Column('callback_at', sa.DateTime(), nullable=True),
    )
    op.add_column(
        'call_prospects',
        sa.Column('callback_notes', sa.String(length=255), nullable=True),
    )
    op.create_index(
        'ix_call_prospects_callback_at',
        'call_prospects',
        ['callback_at'],
        unique=False,
    )


def downgrade() -> None:
    with op.batch_alter_table('call_prospects', schema=None) as batch_op:
        batch_op.drop_index('ix_call_prospects_callback_at')
        batch_op.drop_column('callback_notes')
        batch_op.drop_column('callback_at')
