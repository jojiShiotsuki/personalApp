"""add_title_to_social_content

Revision ID: dd45e5058f99
Revises: 5a536200f329
Create Date: 2026-01-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dd45e5058f99'
down_revision: Union[str, None] = '5a536200f329'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add title column to social_content table
    op.add_column('social_content', sa.Column('title', sa.String(length=255), nullable=True))


def downgrade() -> None:
    # Remove title column
    op.drop_column('social_content', 'title')
