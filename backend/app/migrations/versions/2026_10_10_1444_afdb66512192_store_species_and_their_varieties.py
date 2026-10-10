"""store species and their varieties

Revision ID: afdb66512192
Revises: d2ec39abf848
Create Date: 2026-10-10 14:44:09.143696

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "afdb66512192"
down_revision: str | Sequence[str] | None = "d2ec39abf848"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "species",
        sa.Column("id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("genus", sa.Text(), nullable=True),
        sa.Column("evolution_chain_id", sa.Integer(), nullable=False),
        sa.Column("evolves_from_species_id", sa.Integer(), nullable=True),
        sa.Column("evolution_methods", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(
            ["evolves_from_species_id"],
            ["species.id"],
            name=op.f("fk_species_evolves_from_species_id_species"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_species")),
        sa.UniqueConstraint("name", name=op.f("uq_species_name")),
    )
    op.create_index(
        op.f("ix_species_evolution_chain_id"), "species", ["evolution_chain_id"], unique=False
    )
    op.create_table(
        "species_varieties",
        sa.Column("pokemon_id", sa.Integer(), nullable=False),
        sa.Column("species_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["pokemon_id"], ["pokemon.id"], name=op.f("fk_species_varieties_pokemon_id_pokemon")
        ),
        sa.ForeignKeyConstraint(
            ["species_id"], ["species.id"], name=op.f("fk_species_varieties_species_id_species")
        ),
        sa.PrimaryKeyConstraint("pokemon_id", name=op.f("pk_species_varieties")),
    )
    op.create_index(
        op.f("ix_species_varieties_species_id"), "species_varieties", ["species_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_species_varieties_species_id"), table_name="species_varieties")
    op.drop_table("species_varieties")
    op.drop_index(op.f("ix_species_evolution_chain_id"), table_name="species")
    op.drop_table("species")
