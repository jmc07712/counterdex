from typing import Any

import pytest
from pydantic import ValidationError

from app.pokemon.enums import PokemonType
from app.pokemon.schemas import Pokemon, PokemonQuery, Stats

GYARADOS = Pokemon(
    id=130,
    name="gyarados",
    types=(PokemonType.WATER, PokemonType.FLYING),
    stats=Stats(hp=95, attack=125, defense=79, sp_attack=60, sp_defense=100, speed=81),
    sprite_url="https://example.com/130.png",
    is_default=True,
)
GYARADOS_COLUMNS: dict[str, Any] = {
    "id": 130,
    "name": "gyarados",
    "types": ["water", "flying"],
    "hp": 95,
    "attack": 125,
    "defense": 79,
    "sp_attack": 60,
    "sp_defense": 100,
    "speed": 81,
    "sprite_url": "https://example.com/130.png",
    "is_default": True,
}


def test_gives_each_stat_its_own_column() -> None:
    assert GYARADOS.to_columns() == GYARADOS_COLUMNS


def test_reads_a_pokemon_back_from_its_columns() -> None:
    assert Pokemon.from_columns(GYARADOS_COLUMNS) == GYARADOS


def test_ignores_the_syncs_bookkeeping_columns() -> None:
    row = GYARADOS_COLUMNS | {"content_hash": "0" * 64, "removed_at": None}

    assert Pokemon.from_columns(row) == GYARADOS


@pytest.mark.parametrize("hp", [0, 256])
def test_rejects_base_stats_outside_1_to_255(hp: int) -> None:
    with pytest.raises(ValidationError, match="hp"):
        Pokemon.from_columns(GYARADOS_COLUMNS | {"hp": hp})


@pytest.mark.parametrize("types", [[], ["water", "flying", "dragon"]])
def test_rejects_anything_but_one_or_two_types(types: list[str]) -> None:
    with pytest.raises(ValidationError, match="types"):
        Pokemon.from_columns(GYARADOS_COLUMNS | {"types": types})


def test_rejects_types_that_do_not_exist() -> None:
    with pytest.raises(ValidationError, match=r"types\.1"):
        Pokemon.from_columns(GYARADOS_COLUMNS | {"types": ["water", "shadow"]})


def test_searches_names_as_they_are_stored() -> None:
    assert PokemonQuery(q="  Charizard Mega X ").q == "charizard-mega-x"


@pytest.mark.parametrize("q", ["", "x" * 51])
def test_rejects_searches_that_are_empty_or_too_long(q: str) -> None:
    with pytest.raises(ValidationError, match="q"):
        PokemonQuery(q=q)


def test_rejects_more_types_than_a_pokemon_can_have() -> None:
    with pytest.raises(ValidationError, match="type"):
        PokemonQuery(types=(PokemonType.FIRE, PokemonType.WATER, PokemonType.GRASS))
