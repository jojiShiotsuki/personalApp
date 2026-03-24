"""add interactive audit columns to audit_results

Revision ID: b325cd94d1be
Revises: 1dc2a1202497
Create Date: 2026-03-24 13:34:56.243006

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b325cd94d1be'
down_revision: Union[str, None] = '1dc2a1202497'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('audit_results', sa.Column('verification_report', sa.Text(), nullable=True))
    op.add_column('audit_results', sa.Column('pagespeed_perf_score', sa.Integer(), nullable=True))
    op.add_column('audit_results', sa.Column('pagespeed_seo_score', sa.Integer(), nullable=True))
    op.add_column('audit_results', sa.Column('pagespeed_a11y_score', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('audit_results', 'pagespeed_a11y_score')
    op.drop_column('audit_results', 'pagespeed_seo_score')
    op.drop_column('audit_results', 'pagespeed_perf_score')
    op.drop_column('audit_results', 'verification_report')
