from collections.abc import Iterable, Sequence
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.pokemon import models, schemas
from app.pokemon.enums import EvolutionTrigger, PokemonType

# Where PokéAPI links Gyarados's sprite, and where the API serves it from instead.
GYARADOS_SPRITE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/130.png"
GYARADOS_CDN_SPRITE = "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/130.png"

# Pikachu as the sync reads it from PokéAPI's recorded response (pokeapi_responses/pokemon-25).
PIKACHU = schemas.Pokemon(
    id=25,
    name="pikachu",
    types=(PokemonType.ELECTRIC,),
    stats=schemas.Stats(hp=35, attack=55, defense=40, sp_attack=50, sp_defense=50, speed=90),
    sprite_url="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png",
    is_default=True,
)

# How Charmander evolves into Charmeleon, and Charmeleon into Charizard.
LEVEL_16 = schemas.EvolutionMethod(trigger=EvolutionTrigger.LEVEL_UP, min_level=16)
LEVEL_36 = schemas.EvolutionMethod(trigger=EvolutionTrigger.LEVEL_UP, min_level=36)


def gyarados_columns() -> dict[str, Any]:
    """Gyarados as the pokemon table's columns, less the sync's bookkeeping.

    Its primary type isn't alphabetically first and its six stats all differ, so a reordered or
    swapped field can't go unnoticed.
    """
    return {
        "id": 130,
        "name": "gyarados",
        "types": ["water", "flying"],
        "hp": 95,
        "attack": 125,
        "defense": 79,
        "sp_attack": 60,
        "sp_defense": 100,
        "speed": 81,
        "sprite_url": GYARADOS_SPRITE,
        "is_default": True,
    }


def make_pokemon(**overrides: Any) -> models.Pokemon:
    """A valid pokemon row, Gyarados by default; tests override only the fields they're about."""
    bookkeeping = {"content_hash": "0" * 64, "last_synced_at": datetime(2026, 10, 10, tzinfo=UTC)}
    return models.Pokemon(**(gyarados_columns() | bookkeeping | overrides))


def add_pokemon(session: Session, *ids: int) -> None:
    """Saves a Pokémon for each Pokédex number, in the order given."""
    session.add_all(make_pokemon(id=pokedex_id, name=f"pokemon-{pokedex_id}") for pokedex_id in ids)
    session.flush()


def with_columns(pokemon: schemas.Pokemon, **columns: Any) -> schemas.Pokemon:
    """A copy of `pokemon` with some of its table columns changed (stats included, e.g. speed=1)."""
    current = pokemon.to_columns()
    if unknown := columns.keys() - current.keys():
        raise TypeError(f"not columns of the pokemon table: {', '.join(sorted(unknown))}")
    return schemas.Pokemon.from_columns(current | columns)


def add_species(
    session: Session,
    species_id: int,
    *,
    family: int,
    evolves_from: int | None = None,
    methods: Sequence[schemas.EvolutionMethod] = (),
    pokemon_ids: Iterable[int] = (),
    **overrides: Any,
) -> None:
    """Saves a species in the evolution family `family`, and links the given Pokémon to it."""
    fields: dict[str, Any] = {
        "id": species_id,
        "name": f"species-{species_id}",
        "genus": None,
        "is_legendary": False,
        "is_mythical": False,
        "evolution_chain_id": family,
        "evolves_from_species_id": evolves_from,
        "evolution_methods": [method.model_dump(mode="json") for method in methods],
    }
    session.add(models.Species(**(fields | overrides)))
    session.flush()
    session.add_all(
        models.SpeciesVariety(pokemon_id=pokemon_id, species_id=species_id)
        for pokemon_id in pokemon_ids
    )
    session.flush()


def stored_varieties(session: Session) -> dict[int, int]:
    """Each stored Pokémon's species, by Pokémon id."""
    rows = session.execute(
        select(models.SpeciesVariety.pokemon_id, models.SpeciesVariety.species_id)
    )
    return dict(rows.all())
