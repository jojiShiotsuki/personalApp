"""add unique constraint on campaign_id email

Revision ID: b3d75cfef794
Revises: 761d7f1a240f
Create Date: 2026-02-22 19:06:40.350597

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3d75cfef794'
down_revision: Union[str, None] = '761d7f1a240f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Remove any true duplicates (same campaign_id + email), keeping earliest
    op.execute("""
        DELETE FROM outreach_prospects
        WHERE id NOT IN (
            SELECT MIN(id) FROM outreach_prospects
            WHERE email IS NOT NULL AND email != ''
            GROUP BY campaign_id, email
        )
        AND email IS NOT NULL AND email != ''
    """)

    # Add a unique index only on real emails (partial index excludes NULL and empty)
    op.execute("""
        CREATE UNIQUE INDEX uq_campaign_email
        ON outreach_prospects (campaign_id, email)
        WHERE email IS NOT NULL AND email != ''
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_campaign_email")
