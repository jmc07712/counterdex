from typing import Any

import pytest
from pydantic import ValidationError

from app.pokemon.schemas import Pokemon, Stats

GYARADOS = Pokemon(
    id=130,
    name="gyarados",
    types=("water", "flying"),
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
