"""add discovered_leads table

Revision ID: 0d541bafa69d
Revises: a1b2c3d4e5f6
Create Date: 2026-02-03 10:08:37.079793

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0d541bafa69d'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'discovered_leads',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('agency_name', sa.String(length=255), nullable=False),
        sa.Column('contact_name', sa.String(length=255), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('website', sa.String(length=500), nullable=False),
        sa.Column('website_normalized', sa.String(length=500), nullable=False),
        sa.Column('niche', sa.String(length=255), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('search_query', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_discovered_leads_id', 'discovered_leads', ['id'], unique=False)
    op.create_index('ix_discovered_leads_website_normalized', 'discovered_leads', ['website_normalized'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_discovered_leads_website_normalized', table_name='discovered_leads')
    op.drop_index('ix_discovered_leads_id', table_name='discovered_leads')
    op.drop_table('discovered_leads')
