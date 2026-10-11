"""What counter teams and threats are worked out from: the type chart, the team's Pokémon and
the Pokémon to choose from.
"""

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.counter.battle import level_50_fighter
from app.counter.types import Candidate, Fighter, TypeChart
from app.pokemon import models, schemas
from app.pokemon.queries import pokemon_from_columns

# What the battle model needs of a Pokémon.
FIGHTER_COLUMNS = (
    models.Pokemon.id,
    models.Pokemon.types,
    models.Pokemon.hp,
    models.Pokemon.attack,
    models.Pokemon.defense,
    models.Pokemon.sp_attack,
    models.Pokemon.sp_defense,
    models.Pokemon.speed,
)


def type_chart(session: Session) -> TypeChart:
    """The stored type chart; empty until a sync has stored it."""
    rows = session.execute(
        select(
            models.TypeMatchup.attacking_type,
            models.TypeMatchup.defending_type,
            models.TypeMatchup.multiplier,
        )
    )
    return {(attacking, defending): multiplier for attacking, defending, multiplier in rows}


def fighters(session: Session, pokemon_ids: Sequence[int]) -> dict[int, Fighter]:
    """These Pokémon at level 50, listed or not, by id. Ids with no Pokémon are left out."""
    rows = session.execute(
        select(*FIGHTER_COLUMNS).where(models.Pokemon.id.in_(pokemon_ids))
    ).mappings()
    return {row["id"]: level_50_fighter(row) for row in rows}


def candidates(session: Session, *, forms: bool, legendaries: bool) -> list[Candidate]:
    """The Pokémon a counter team or a threat can be, by id: the ones PokéAPI lists whose
    species is stored, only default forms unless `forms`, and no legendary or mythical species
    unless `legendaries`.
    """
    statement = (
        select(*FIGHTER_COLUMNS, models.Species.evolution_chain_id)
        .join(models.SpeciesVariety, models.SpeciesVariety.pokemon_id == models.Pokemon.id)
        .join(models.Species, models.Species.id == models.SpeciesVariety.species_id)
        .where(models.Pokemon.removed_at.is_(None))
        .order_by(models.Pokemon.id)
    )
    if not forms:
        statement = statement.where(models.Pokemon.is_default.is_(True))
    if not legendaries:
        statement = statement.where(
            models.Species.is_legendary.is_(False), models.Species.is_mythical.is_(False)
        )
    return [
        Candidate(level_50_fighter(row), family_id=row["evolution_chain_id"])
        for row in session.execute(statement).mappings()
    ]


def pokemon(session: Session, pokemon_ids: Sequence[int]) -> dict[int, schemas.Pokemon]:
    """These Pokémon as the API serves them, with their species and family, by id."""
    rows = session.execute(
        select(
            models.Pokemon.__table__,
            models.SpeciesVariety.species_id,
            models.Species.evolution_chain_id.label("family_id"),
        )
        .outerjoin(models.SpeciesVariety, models.SpeciesVariety.pokemon_id == models.Pokemon.id)
        .outerjoin(models.Species, models.Species.id == models.SpeciesVariety.species_id)
        .where(models.Pokemon.id.in_(pokemon_ids))
    ).mappings()
    return {row["id"]: pokemon_from_columns(row) for row in rows}
