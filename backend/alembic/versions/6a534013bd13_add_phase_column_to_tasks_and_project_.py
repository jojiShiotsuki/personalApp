"""add phase column to tasks and project_template_tasks

Revision ID: 6a534013bd13
Revises: c3a1f8b92d4e
Create Date: 2026-02-14 15:18:44.567068

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6a534013bd13'
down_revision: Union[str, None] = 'c3a1f8b92d4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tasks', sa.Column('phase', sa.String(255), nullable=True))
    op.add_column('project_template_tasks', sa.Column('phase', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('project_template_tasks', 'phase')
    op.drop_column('tasks', 'phase')
