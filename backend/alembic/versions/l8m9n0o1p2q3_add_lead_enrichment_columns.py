"""add lead enrichment columns

Revision ID: l8m9n0o1p2q3
Revises: k7l8m9n0o1p2
Create Date: 2026-02-09 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'l8m9n0o1p2q3'
down_revision: Union[str, None] = 'k7l8m9n0o1p2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('discovered_leads', sa.Column('confidence', sa.String(length=10), nullable=True))
    op.add_column('discovered_leads', sa.Column('confidence_signals', sa.JSON(), nullable=True))
    op.add_column('discovered_leads', sa.Column('linkedin_url', sa.String(length=500), nullable=True))
    op.add_column('discovered_leads', sa.Column('facebook_url', sa.String(length=500), nullable=True))
    op.add_column('discovered_leads', sa.Column('instagram_url', sa.String(length=500), nullable=True))
    op.add_column('discovered_leads', sa.Column('email_source', sa.String(length=20), nullable=True))
    op.add_column('discovered_leads', sa.Column('last_enriched_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('discovered_leads', 'last_enriched_at')
    op.drop_column('discovered_leads', 'email_source')
    op.drop_column('discovered_leads', 'instagram_url')
    op.drop_column('discovered_leads', 'facebook_url')
    op.drop_column('discovered_leads', 'linkedin_url')
    op.drop_column('discovered_leads', 'confidence_signals')
    op.drop_column('discovered_leads', 'confidence')
