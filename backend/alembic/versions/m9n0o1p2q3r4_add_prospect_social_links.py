"""add prospect social links

Revision ID: m9n0o1p2q3r4
Revises: 13a052f682b9
Create Date: 2026-02-10 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'm9n0o1p2q3r4'
down_revision: Union[str, None] = '13a052f682b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('outreach_prospects', sa.Column('linkedin_url', sa.String(500), nullable=True))
    op.add_column('outreach_prospects', sa.Column('facebook_url', sa.String(500), nullable=True))
    op.add_column('outreach_prospects', sa.Column('instagram_url', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('outreach_prospects', 'instagram_url')
    op.drop_column('outreach_prospects', 'facebook_url')
    op.drop_column('outreach_prospects', 'linkedin_url')
