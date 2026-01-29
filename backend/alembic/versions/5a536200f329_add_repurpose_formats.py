"""add_repurpose_formats

Revision ID: 5a536200f329
Revises: 436df366a6fc
Create Date: 2026-01-23 14:24:40.826137

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5a536200f329'
down_revision: Union[str, None] = '436df366a6fc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add repurpose_formats JSON column to social_content table
    op.add_column('social_content', sa.Column('repurpose_formats', sa.JSON(), nullable=True))


def downgrade() -> None:
    # Remove repurpose_formats column
    op.drop_column('social_content', 'repurpose_formats')
