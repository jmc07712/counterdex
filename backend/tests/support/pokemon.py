from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.pokemon import models, schemas

GYARADOS_SPRITE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/130.png"


def make_pokemon(**overrides: Any) -> models.Pokemon:
    """A valid pokemon row; tests override only the fields they're about.

    Gyarados by default: its primary type isn't alphabetically first and its six stats all
    differ, so a reordered or swapped field can't go unnoticed.
    """
    fields: dict[str, Any] = {
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
        "content_hash": "0" * 64,
        "last_synced_at": datetime(2026, 10, 10, tzinfo=UTC),
    }
    return models.Pokemon(**(fields | overrides))


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
