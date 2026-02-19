"""add delivery stages and contact_id to projects

Revision ID: f7e8d9c0b1a2
Revises: 923a50d9baf8
Create Date: 2026-02-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7e8d9c0b1a2'
down_revision: Union[str, None] = '923a50d9baf8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add contact_id column to projects table
    # SQLite doesn't enforce enum constraints, so new status values
    # (scoping, review, revisions) work automatically as strings
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.add_column(sa.Column('contact_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.drop_column('contact_id')
