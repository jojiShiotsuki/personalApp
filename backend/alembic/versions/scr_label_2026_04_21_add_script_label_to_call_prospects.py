"""add script_label column to call_prospects

Free-text tag for A/B testing phone scripts. Cold-call user labels
prospects (e.g. "Script A", "Script B") to track which variant was
used. Rendered as a deterministic-colored pill on the prospect card.

Nullable, no index, max 50 chars. NULL or empty string = no label.

Revision ID: scr_label_2026_04_21
Revises: add_addl_phones_2026_04_20
Create Date: 2026-04-21 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "scr_label_2026_04_21"
down_revision: Union[str, None] = "add_addl_phones_2026_04_20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "call_prospects",
        sa.Column("script_label", sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("call_prospects", "script_label")
