"""add project_templates tables

Revision ID: ab9f7222dc43
Revises: y1z2a3b4c5d6
Create Date: 2026-02-14 14:04:15.348637

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ab9f7222dc43'
down_revision: Union[str, None] = 'y1z2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'project_templates',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_table(
        'project_template_tasks',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('template_id', sa.Integer(), sa.ForeignKey('project_templates.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('priority', sa.String(10), nullable=False, server_default='medium'),
        sa.Column('order', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_table('project_template_tasks')
    op.drop_table('project_templates')
