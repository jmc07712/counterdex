"""allow one pokemon per evolution family on a team

Revision ID: 6eaf84154707
Revises: 966f561322e0
Create Date: 2026-10-11 14:53:53.750602

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6eaf84154707"
down_revision: str | Sequence[str] | None = "966f561322e0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("team_members", sa.Column("family_id", sa.Integer(), nullable=True))
    # A member's family is its species' evolution chain.
    op.execute(
        """
        update team_members set family_id = species.evolution_chain_id
        from species
        where species.id = team_members.species_id
        """
    )
    op.alter_column("team_members", "family_id", nullable=False)
    op.create_unique_constraint(
        "uq_species_id_evolution_chain_id", "species", ["id", "evolution_chain_id"]
    )
    op.create_foreign_key(
        "fk_team_members_species_id_species",
        "team_members",
        "species",
        ["species_id", "family_id"],
        ["id", "evolution_chain_id"],
        onupdate="CASCADE",
    )
    op.create_unique_constraint(
        "uq_team_members_team_id_family_id", "team_members", ["team_id", "family_id"]
    )
    # A species belongs to one family, so one Pokémon from each family is also one of each
    # species: the species constraint is no longer needed.
    op.drop_constraint("uq_team_members_team_id_species_id", "team_members", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint(
        "uq_team_members_team_id_species_id", "team_members", ["team_id", "species_id"]
    )
    op.drop_constraint("uq_team_members_team_id_family_id", "team_members", type_="unique")
    op.drop_constraint("fk_team_members_species_id_species", "team_members", type_="foreignkey")
    op.drop_constraint("uq_species_id_evolution_chain_id", "species", type_="unique")
    op.drop_column("team_members", "family_id")
