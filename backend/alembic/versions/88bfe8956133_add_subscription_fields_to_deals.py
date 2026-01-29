"""add_subscription_fields_to_deals

Revision ID: 88bfe8956133
Revises: 363504e46277
Create Date: 2025-11-27 15:29:04.161747

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '88bfe8956133'
down_revision: Union[str, None] = '363504e46277'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add subscription/recurring service fields to crm_deals
    op.add_column('crm_deals', sa.Column('is_recurring', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('crm_deals', sa.Column('billing_frequency', sa.String(length=20), nullable=True))
    op.add_column('crm_deals', sa.Column('recurring_amount', sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column('crm_deals', sa.Column('next_billing_date', sa.Date(), nullable=True))
    op.add_column('crm_deals', sa.Column('service_status', sa.String(length=20), nullable=True))
    op.add_column('crm_deals', sa.Column('service_start_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('crm_deals', 'service_start_date')
    op.drop_column('crm_deals', 'service_status')
    op.drop_column('crm_deals', 'next_billing_date')
    op.drop_column('crm_deals', 'recurring_amount')
    op.drop_column('crm_deals', 'billing_frequency')
    op.drop_column('crm_deals', 'is_recurring')
