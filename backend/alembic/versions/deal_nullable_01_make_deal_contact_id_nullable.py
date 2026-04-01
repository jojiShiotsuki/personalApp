"""make deal contact_id nullable

Allow deals to exist without a linked contact, supporting contactless
pipeline entries (e.g. Instagram DM leads added before a full contact
record is created).

Revision ID: deal_nullable_01
Revises: li_followup_01
Create Date: 2026-04-01
"""
from alembic import op
from alembic import context
import sqlalchemy as sa

revision = 'deal_nullable_01'
down_revision = 'li_followup_01'
branch_labels = None
depends_on = None


def upgrade():
    dialect = context.get_context().dialect.name

    if dialect == 'sqlite':
        with op.batch_alter_table('crm_deals') as batch_op:
            batch_op.alter_column(
                'contact_id',
                existing_type=sa.Integer(),
                nullable=True,
            )
    else:
        # PostgreSQL: alter column + recreate FK with SET NULL
        op.alter_column(
            'crm_deals',
            'contact_id',
            existing_type=sa.Integer(),
            nullable=True,
        )

        # Drop old CASCADE FK and recreate with SET NULL
        # Introspect to find the actual constraint name
        bind = op.get_bind()
        inspector = sa.inspect(bind)
        fks = inspector.get_foreign_keys('crm_deals')
        for fk in fks:
            if fk['referred_table'] == 'crm_contacts' and 'contact_id' in fk['constrained_columns']:
                constraint_name = fk['name']
                if constraint_name:
                    op.drop_constraint(constraint_name, 'crm_deals', type_='foreignkey')
                break

        op.create_foreign_key(
            'fk_crm_deals_contact_id',
            'crm_deals',
            'crm_contacts',
            ['contact_id'],
            ['id'],
            ondelete='SET NULL',
        )


def downgrade():
    dialect = context.get_context().dialect.name

    if dialect == 'sqlite':
        with op.batch_alter_table('crm_deals') as batch_op:
            batch_op.alter_column(
                'contact_id',
                existing_type=sa.Integer(),
                nullable=False,
            )
    else:
        # Drop SET NULL FK and recreate with CASCADE
        op.drop_constraint('fk_crm_deals_contact_id', 'crm_deals', type_='foreignkey')
        op.create_foreign_key(
            'fk_crm_deals_contact_id',
            'crm_deals',
            'crm_contacts',
            ['contact_id'],
            ['id'],
            ondelete='CASCADE',
        )
        op.alter_column(
            'crm_deals',
            'contact_id',
            existing_type=sa.Integer(),
            nullable=False,
        )
