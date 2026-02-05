"""add tradie fields to contacts

Revision ID: b22a8df02666
Revises: 0d541bafa69d
Create Date: 2026-02-04 11:00:36.786539

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b22a8df02666'
down_revision: Union[str, None] = '0d541bafa69d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add tradie-specific fields to contacts table
    op.add_column('crm_contacts', sa.Column('industry', sa.String(length=50), nullable=True))
    op.add_column('crm_contacts', sa.Column('suburb', sa.String(length=100), nullable=True))
    op.add_column('crm_contacts', sa.Column('city', sa.String(length=100), nullable=True))
    op.add_column('crm_contacts', sa.Column('website_url', sa.String(length=500), nullable=True))
    op.add_column('crm_contacts', sa.Column('website_issues', sa.Text(), nullable=True))
    op.add_column('crm_contacts', sa.Column('website_speed_score', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('crm_contacts', 'website_speed_score')
    op.drop_column('crm_contacts', 'website_issues')
    op.drop_column('crm_contacts', 'website_url')
    op.drop_column('crm_contacts', 'city')
    op.drop_column('crm_contacts', 'suburb')
    op.drop_column('crm_contacts', 'industry')
