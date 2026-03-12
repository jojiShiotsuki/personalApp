"""add requires_linkedin_connected to multi_touch_steps

Revision ID: 6046b2ee1844
Revises: 46e345a2ed2a
Create Date: 2026-03-12 09:50:04.216275

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '6046b2ee1844'
down_revision: Union[str, None] = '46e345a2ed2a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('multi_touch_steps', sa.Column('requires_linkedin_connected', sa.Boolean(), server_default='0', nullable=True))


def downgrade() -> None:
    op.drop_column('multi_touch_steps', 'requires_linkedin_connected')
