"""add reel_type column to social_content

Revision ID: 6538621a9392
Revises: dd45e5058f99
Create Date: 2026-01-23 15:57:54.963168

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6538621a9392'
down_revision: Union[str, None] = 'dd45e5058f99'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('social_content', sa.Column('reel_type', sa.Enum('EDUCATIONAL', 'BEFORE_AFTER', 'BTS', 'SOCIAL_PROOF', name='reeltype'), nullable=True))


def downgrade() -> None:
    op.drop_column('social_content', 'reel_type')
