"""App Studio: per-jeweller store credentials key + monotonic build number

Revision ID: d7f3b2c91e58
Revises: c5e2a7d81f39
"""
from alembic import op

revision = "d7f3b2c91e58"
down_revision = "c5e2a7d81f39"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS store_creds_key VARCHAR(40) DEFAULT ''")
    op.execute("ALTER TABLE jewellers ADD COLUMN IF NOT EXISTS app_build_number INTEGER DEFAULT 0")


def downgrade():
    op.execute("ALTER TABLE jewellers DROP COLUMN IF EXISTS store_creds_key")
    op.execute("ALTER TABLE jewellers DROP COLUMN IF EXISTS app_build_number")
