"""backfill prospect website_issues from discovered leads

Revision ID: y1z2a3b4c5d6
Revises: x0y1z2a3b4c5
Create Date: 2026-02-12
"""
from alembic import op
import sqlalchemy as sa
import json

# revision identifiers, used by Alembic.
revision = 'y1z2a3b4c5d6'
down_revision = 'x0y1z2a3b4c5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    dialect = connection.dialect.name

    if dialect == 'sqlite':
        # SQLite: JSON is stored as text, direct copy works
        connection.execute(sa.text("""
            UPDATE outreach_prospects
            SET website_issues = (
                SELECT dl.website_issues
                FROM discovered_leads dl
                WHERE dl.id = outreach_prospects.discovered_lead_id
                  AND dl.website_issues IS NOT NULL
            )
            WHERE discovered_lead_id IS NOT NULL
              AND website_issues IS NULL
        """))
    else:
        # PostgreSQL: use UPDATE FROM for better performance
        connection.execute(sa.text("""
            UPDATE outreach_prospects p
            SET website_issues = dl.website_issues
            FROM discovered_leads dl
            WHERE dl.id = p.discovered_lead_id
              AND p.website_issues IS NULL
              AND dl.website_issues IS NOT NULL
        """))


def downgrade() -> None:
    pass
