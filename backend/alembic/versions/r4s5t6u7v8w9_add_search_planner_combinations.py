"""add search_planner_combinations table

Revision ID: r4s5t6u7v8w9
Revises: q3r4s5t6u7v8
Create Date: 2026-02-11
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'r4s5t6u7v8w9'
down_revision = 'q3r4s5t6u7v8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'search_planner_combinations',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('country', sa.String(100), nullable=False, index=True),
        sa.Column('city', sa.String(200), nullable=False),
        sa.Column('niche', sa.String(500), nullable=False),
        sa.Column('is_searched', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('searched_at', sa.DateTime(), nullable=True),
        sa.Column('leads_found', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('country', 'city', 'niche', name='uq_country_city_niche'),
    )


def downgrade() -> None:
    op.drop_table('search_planner_combinations')
