"""add subject variant AB testing columns

Revision ID: 55ca050ba1bb
Revises: 012874046c48
Create Date: 2026-03-21 14:41:40.056618

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '55ca050ba1bb'
down_revision: Union[str, None] = '012874046c48'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('audit_results', sa.Column('generated_subject_variant', sa.String(length=500), nullable=True))
    op.add_column('experiments', sa.Column('subject_variant_used', sa.String(length=10), nullable=True))


def downgrade() -> None:
    op.drop_column('experiments', 'subject_variant_used')
    op.drop_column('audit_results', 'generated_subject_variant')
