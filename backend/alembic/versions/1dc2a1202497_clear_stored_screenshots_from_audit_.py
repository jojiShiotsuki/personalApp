"""clear stored screenshots from audit_results

Revision ID: 1dc2a1202497
Revises: 4cbfe8525ec5
Create Date: 2026-03-24 12:27:54.918506

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1dc2a1202497'
down_revision: Union[str, None] = '4cbfe8525ec5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE audit_results SET desktop_screenshot = NULL, mobile_screenshot = NULL, verification_screenshots = NULL "
        "WHERE desktop_screenshot IS NOT NULL OR mobile_screenshot IS NOT NULL OR verification_screenshots IS NOT NULL"
    )


def downgrade() -> None:
    pass  # screenshots cannot be recovered
