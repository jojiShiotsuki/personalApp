"""add additional_phones JSON column to call_prospects

Apollo CSVs include up to five phone columns per contact (Mobile, Work
Direct, Corporate, Home, Other). The CSV import already collapses them to
a single `phone` (first non-empty) but the rest were discarded. The cold
call card needs every available number so the user picks the right one.

Stores a JSON list of {label, value} objects, where label is the original
CSV column header — useful context ("Mobile" vs "Corporate") at call time.

Additive, nullable. SQLAlchemy JSON type maps to JSONB on Postgres and
JSON-as-text on SQLite.

Revision ID: a7b8c9d0e1f2
Revises: e1a2b3c4d5f6
Create Date: 2026-04-20 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, None] = "e1a2b3c4d5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "call_prospects",
        sa.Column("additional_phones", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("call_prospects", "additional_phones")
