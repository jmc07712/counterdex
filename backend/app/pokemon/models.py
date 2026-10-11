from datetime import datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, text_enum
from app.pokemon.constants import (
    MAX_BASE_STAT,
    MAX_TYPES,
    MIN_BASE_STAT,
    MIN_TYPES,
    TYPE_MULTIPLIERS,
)
from app.pokemon.enums import PokemonType
from app.pokemon.schemas import STAT_NAMES

# PokemonType's values as a Postgres array, so the table accepts only those types.
TYPE_VALUES = f"array[{', '.join(repr(type_.value) for type_ in PokemonType)}]::text[]"


class Pokemon(Base):
    """Our copy of the PokéAPI fields the app uses, kept current by the sync job."""

    __tablename__ = "pokemon"
    __table_args__ = (
        CheckConstraint(
            f"cardinality(types) between {MIN_TYPES} and {MAX_TYPES}", name="one_or_two_types"
        ),
        CheckConstraint(f"types <@ {TYPE_VALUES}", name="known_types"),
        *(
            CheckConstraint(
                f"{stat} between {MIN_BASE_STAT} and {MAX_BASE_STAT}", name=f"{stat}_in_range"
            )
            for stat in STAT_NAMES
        ),
    )

    # PokéAPI's own id, so it isn't generated here.
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    name: Mapped[str] = mapped_column(Text, unique=True)
    # In slot order; PokéAPI lists a Pokémon's primary type first.
    types: Mapped[list[str]] = mapped_column(ARRAY(Text))
    hp: Mapped[int] = mapped_column(SmallInteger)
    attack: Mapped[int] = mapped_column(SmallInteger)
    defense: Mapped[int] = mapped_column(SmallInteger)
    sp_attack: Mapped[int] = mapped_column(SmallInteger)
    sp_defense: Mapped[int] = mapped_column(SmallInteger)
    speed: Mapped[int] = mapped_column(SmallInteger)
    sprite_url: Mapped[str | None] = mapped_column(Text)
    # False for alternate forms (megas, regional variants, etc.).
    is_default: Mapped[bool]
    # SHA-256 of the tracked fields; lets the sync job skip unchanged Pokémon cheaply.
    content_hash: Mapped[str] = mapped_column(String(64))
    last_synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # Set when PokéAPI stops listing the Pokémon. Rows are never deleted, so teams keep working.
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # When a sync last changed it: updated its data, removed it or listed it again. Joining the
    # Pokédex isn't a change. Kept here so lists can filter on it without the change history.
    last_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Species(Base):
    """A species, such as Charizard, and its place in its evolution family.

    Reference data refreshed by every sync: unlike the pokemon table, changes aren't tracked.
    """

    __tablename__ = "species"
    __table_args__ = (
        # Lets a team member refer to a species and its family together, in one foreign key.
        UniqueConstraint("id", "evolution_chain_id", name="uq_species_id_evolution_chain_id"),
    )

    # PokéAPI's id, which is the species' Pokédex number.
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    name: Mapped[str] = mapped_column(Text, unique=True)
    # e.g. "Flame Pokémon".
    genus: Mapped[str | None] = mapped_column(Text)
    # As PokéAPI marks them, e.g. Mewtwo is legendary and Mew is mythical.
    is_legendary: Mapped[bool]
    is_mythical: Mapped[bool]
    # PokéAPI's id for the evolution family: the species that share it are one family.
    evolution_chain_id: Mapped[int] = mapped_column(index=True)
    evolves_from_species_id: Mapped[int | None] = mapped_column(ForeignKey("species.id"))
    # How it evolves from evolves_from_species_id: schemas.EvolutionMethod objects.
    evolution_methods: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)


class SpeciesVariety(Base):
    """Which species each Pokémon belongs to, e.g. Mega Charizard X belongs to Charizard."""

    __tablename__ = "species_varieties"
    __table_args__ = (
        # Lets a team member refer to a Pokémon and its species together, in one foreign key.
        UniqueConstraint(
            "pokemon_id", "species_id", name="uq_species_varieties_pokemon_id_species_id"
        ),
    )

    pokemon_id: Mapped[int] = mapped_column(ForeignKey("pokemon.id"), primary_key=True)
    species_id: Mapped[int] = mapped_column(ForeignKey("species.id"), index=True)


class TypeMatchup(Base):
    """How much damage a move of one type does to a Pokémon of another: one cell of the type
    chart, which has a row for every pair of types.

    Reference data refreshed by every sync, like species: changes aren't tracked.
    """

    __tablename__ = "type_matchups"
    __table_args__ = (
        CheckConstraint(
            f"multiplier in ({', '.join(map(str, TYPE_MULTIPLIERS))})", name="known_multiplier"
        ),
    )

    attacking_type: Mapped[PokemonType] = mapped_column(
        text_enum(PokemonType, check_name="known_attacking_type"), primary_key=True
    )
    defending_type: Mapped[PokemonType] = mapped_column(
        text_enum(PokemonType, check_name="known_defending_type"), primary_key=True
    )
    # The share of the move's damage the defending type takes.
    multiplier: Mapped[float]
