"""add linkedin_connected to outreach_prospects

Revision ID: 46e345a2ed2a
Revises: a2e704b973a0
Create Date: 2026-03-12 08:59:24.434030

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '46e345a2ed2a'
down_revision: Union[str, None] = 'a2e704b973a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('outreach_prospects', sa.Column('linkedin_connected', sa.Boolean(), server_default='0', nullable=True))
    # Migrate existing CONNECTED prospects: mark linkedin_connected and move to IN_SEQUENCE
    op.execute("UPDATE outreach_prospects SET linkedin_connected = 1, status = 'IN_SEQUENCE' WHERE status = 'CONNECTED'")


def downgrade() -> None:
    op.drop_column('outreach_prospects', 'linkedin_connected')
