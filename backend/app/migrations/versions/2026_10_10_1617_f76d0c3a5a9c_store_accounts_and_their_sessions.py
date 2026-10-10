"""store accounts and their sessions

Revision ID: f76d0c3a5a9c
Revises: 8fe1e056e7d1
Create Date: 2026-10-10 16:17:34.874781

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f76d0c3a5a9c"
down_revision: str | Sequence[str] | None = "8fe1e056e7d1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("username", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("is_admin", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "username ~ '^[A-Za-z0-9_-]{3,32}$'", name=op.f("ck_users_valid_username")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )
    # Unique ignoring case: "Ash" and "ash" are one user.
    op.create_index(
        "uq_users_lower_username", "users", [sa.literal_column("lower(username)")], unique=True
    )
    op.create_table(
        "user_sessions",
        sa.Column("token_hash", sa.LargeBinary(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_user_sessions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("token_hash", name=op.f("pk_user_sessions")),
    )
    op.create_index(op.f("ix_user_sessions_user_id"), "user_sessions", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_sessions_user_id"), table_name="user_sessions")
    op.drop_table("user_sessions")
    op.drop_index("uq_users_lower_username", table_name="users")
    op.drop_table("users")
