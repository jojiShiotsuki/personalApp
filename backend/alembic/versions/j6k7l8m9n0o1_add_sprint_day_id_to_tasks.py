"""add sprint_day_id to tasks

Revision ID: j6k7l8m9n0o1
Revises: i5j6k7l8m9n0
Create Date: 2026-02-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'j6k7l8m9n0o1'
down_revision: Union[str, None] = 'i5j6k7l8m9n0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use batch mode for SQLite compatibility
    with op.batch_alter_table('tasks', schema=None) as batch_op:
        batch_op.add_column(sa.Column('sprint_day_id', sa.Integer(), nullable=True))
        batch_op.create_index('ix_tasks_sprint_day_id', ['sprint_day_id'], unique=False)
        batch_op.create_foreign_key(
            'fk_tasks_sprint_day_id',
            'sprint_days',
            ['sprint_day_id'], ['id'],
            ondelete='SET NULL'
        )


def downgrade() -> None:
    with op.batch_alter_table('tasks', schema=None) as batch_op:
        batch_op.drop_constraint('fk_tasks_sprint_day_id', type_='foreignkey')
        batch_op.drop_index('ix_tasks_sprint_day_id')
        batch_op.drop_column('sprint_day_id')
