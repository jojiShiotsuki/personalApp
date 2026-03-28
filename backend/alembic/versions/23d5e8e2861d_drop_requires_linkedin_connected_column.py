"""drop requires_linkedin_connected column

Revision ID: 23d5e8e2861d
Revises: 6af06d98663a
Create Date: 2026-03-28 11:09:27.614649

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '23d5e8e2861d'
down_revision: Union[str, None] = '6af06d98663a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('multi_touch_steps', 'requires_linkedin_connected')


def downgrade() -> None:
    op.add_column('multi_touch_steps', sa.Column(
        'requires_linkedin_connected',
        sa.BOOLEAN(),
        server_default=sa.text('false'),
        nullable=True,
    ))
