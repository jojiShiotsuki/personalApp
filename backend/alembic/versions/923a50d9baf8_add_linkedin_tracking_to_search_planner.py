"""add linkedin tracking to search planner

Revision ID: 923a50d9baf8
Revises: 5186f2c72fce
Create Date: 2026-02-15 09:29:03.926688

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '923a50d9baf8'
down_revision: Union[str, None] = '5186f2c72fce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('search_planner_combinations',
        sa.Column('linkedin_searched', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('search_planner_combinations',
        sa.Column('linkedin_searched_at', sa.DateTime(), nullable=True))
    op.add_column('search_planner_combinations',
        sa.Column('linkedin_leads_found', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('search_planner_combinations', 'linkedin_leads_found')
    op.drop_column('search_planner_combinations', 'linkedin_searched_at')
    op.drop_column('search_planner_combinations', 'linkedin_searched')
