"""replace dm_number with template_type in outreach_templates

Revision ID: t6u7v8w9x0y1
Revises: s5t6u7v8w9x0
Create Date: 2026-02-12
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 't6u7v8w9x0y1'
down_revision = 's5t6u7v8w9x0'
branch_labels = None
depends_on = None

# Mapping from old dm_number to new template_type
DM_NUMBER_TO_TYPE = {
    1: 'email_1',
    2: 'email_2',
    3: 'email_3',
    4: 'email_4',
    5: 'email_5',
}


def upgrade() -> None:
    connection = op.get_bind()

    # Check if template_type column already exists (handles partial migration on SQLite)
    inspector = sa.inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('outreach_templates')]
    if 'template_type' not in columns:
        op.add_column('outreach_templates', sa.Column('template_type', sa.String(50), nullable=True))

    # Migrate existing data: map dm_number -> template_type
    if 'dm_number' in columns:
        for dm_num, ttype in DM_NUMBER_TO_TYPE.items():
            connection.execute(
                sa.text("UPDATE outreach_templates SET template_type = :ttype WHERE dm_number = :dm_num"),
                {"ttype": ttype, "dm_num": dm_num}
            )
    # Set default for any unmapped rows
    connection.execute(
        sa.text("UPDATE outreach_templates SET template_type = 'email_1' WHERE template_type IS NULL")
    )

    # Drop old unique constraint explicitly (required for PostgreSQL)
    # On SQLite the constraint is unnamed so we skip — batch_alter_table handles it
    if 'dm_number' in columns:
        dialect = connection.dialect.name
        if dialect != 'sqlite':
            op.drop_constraint('uq_niche_situation_dm', 'outreach_templates', type_='unique')

    # Use batch operations for SQLite compatibility (recreates the table)
    with op.batch_alter_table('outreach_templates', schema=None) as batch_op:
        batch_op.alter_column('template_type', nullable=False, server_default='email_1')
        if 'dm_number' in columns:
            batch_op.drop_column('dm_number')
        batch_op.create_unique_constraint('uq_niche_situation_template_type', ['niche_id', 'situation_id', 'template_type'])


def downgrade() -> None:
    op.add_column('outreach_templates', sa.Column('dm_number', sa.Integer(), nullable=True))

    # Map template_type back to dm_number
    connection = op.get_bind()
    for dm_num, ttype in DM_NUMBER_TO_TYPE.items():
        connection.execute(
            sa.text("UPDATE outreach_templates SET dm_number = :dm_num WHERE template_type = :ttype"),
            {"dm_num": dm_num, "ttype": ttype}
        )
    # Default unmapped to 1
    connection.execute(
        sa.text("UPDATE outreach_templates SET dm_number = 1 WHERE dm_number IS NULL")
    )

    # Drop new constraint explicitly (required for PostgreSQL)
    dialect = connection.dialect.name
    if dialect != 'sqlite':
        op.drop_constraint('uq_niche_situation_template_type', 'outreach_templates', type_='unique')

    with op.batch_alter_table('outreach_templates', schema=None) as batch_op:
        batch_op.alter_column('dm_number', nullable=False, server_default='1')
        batch_op.drop_column('template_type')
        batch_op.create_unique_constraint('uq_niche_situation_dm', ['niche_id', 'situation_id', 'dm_number'])
