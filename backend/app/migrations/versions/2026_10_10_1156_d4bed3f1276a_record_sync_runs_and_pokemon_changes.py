"""record sync runs and pokemon changes

Revision ID: d4bed3f1276a
Revises: a1a1ee2cb243
Create Date: 2026-10-10 11:56:57.538653

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "d4bed3f1276a"
down_revision: str | Sequence[str] | None = "a1a1ee2cb243"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sync_runs",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("fetched", sa.Integer(), nullable=False),
        sa.Column("inserted", sa.Integer(), nullable=False),
        sa.Column("updated", sa.Integer(), nullable=False),
        sa.Column("unchanged", sa.Integer(), nullable=False),
        sa.Column("removed", sa.Integer(), nullable=False),
        sa.Column("restored", sa.Integer(), nullable=False),
        sa.Column("failed", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.CheckConstraint(
            "status in ('succeeded', 'failed')", name=op.f("ck_sync_runs_known_status")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sync_runs")),
    )
    op.create_table(
        "pokemon_changes",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("pokemon_id", sa.Integer(), nullable=False),
        sa.Column("sync_run_id", sa.BigInteger(), nullable=False),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("before", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("after", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.CheckConstraint(
            "kind in ('updated', 'removed', 'restored')", name=op.f("ck_pokemon_changes_known_kind")
        ),
        sa.ForeignKeyConstraint(
            ["pokemon_id"], ["pokemon.id"], name=op.f("fk_pokemon_changes_pokemon_id_pokemon")
        ),
        sa.ForeignKeyConstraint(
            ["sync_run_id"], ["sync_runs.id"], name=op.f("fk_pokemon_changes_sync_run_id_sync_runs")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pokemon_changes")),
    )
    op.create_index(
        "ix_pokemon_changes_pokemon_id_detected_at",
        "pokemon_changes",
        ["pokemon_id", "detected_at"],
        unique=False,
    )
    op.add_column("pokemon", sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("pokemon", "removed_at")
    op.drop_index("ix_pokemon_changes_pokemon_id_detected_at", table_name="pokemon_changes")
    op.drop_table("pokemon_changes")
    op.drop_table("sync_runs")
