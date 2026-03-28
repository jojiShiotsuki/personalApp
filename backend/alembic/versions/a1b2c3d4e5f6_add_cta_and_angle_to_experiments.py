"""add cta_used and angle_used to experiments

Revision ID: a1b2c3d4e5f6
Revises: 23d5e8e2861d
Create Date: 2026-03-28
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = '23d5e8e2861d'
branch_labels = None
depends_on = None


def _column_exists(table, column):
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = [c['name'] for c in inspector.get_columns(table)]
    return column in columns


def upgrade():
    if not _column_exists('experiments', 'cta_used'):
        op.add_column('experiments', sa.Column('cta_used', sa.String(500), nullable=True))
    if not _column_exists('experiments', 'angle_used'):
        op.add_column('experiments', sa.Column('angle_used', sa.String(100), nullable=True))


def downgrade():
    if _column_exists('experiments', 'angle_used'):
        op.drop_column('experiments', 'angle_used')
    if _column_exists('experiments', 'cta_used'):
        op.drop_column('experiments', 'cta_used')
