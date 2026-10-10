import json
from dataclasses import replace
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from app.sync.normalize import PokemonRecord, normalize
from app.sync.pokeapi import PokeApiPokemon

FIXTURES = Path(__file__).parent / "fixtures" / "pokeapi"


def load_fixture(pokemon_id: int) -> dict[str, Any]:
    data: dict[str, Any] = json.loads((FIXTURES / f"pokemon-{pokemon_id}.json").read_text())
    return data


def test_normalizes_a_pokeapi_response() -> None:
    record = normalize(PokeApiPokemon.model_validate(load_fixture(25)))

    assert record == PokemonRecord(
        id=25,
        name="pikachu",
        types=("electric",),
        hp=35,
        attack=55,
        defense=40,
        sp_attack=50,
        sp_defense=50,
        speed=90,
        sprite_url="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png",
        is_default=True,
    )


def test_orders_types_by_slot_not_list_position() -> None:
    raw = load_fixture(6)
    raw["types"].reverse()

    record = normalize(PokeApiPokemon.model_validate(raw))

    assert record.types == ("fire", "flying")


def test_allows_a_missing_sprite() -> None:
    raw = load_fixture(25)
    raw["sprites"]["front_default"] = None

    assert normalize(PokeApiPokemon.model_validate(raw)).sprite_url is None


def test_rejects_a_pokemon_missing_a_base_stat() -> None:
    raw = load_fixture(25)
    raw["stats"] = [s for s in raw["stats"] if s["stat"]["name"] != "speed"]

    with pytest.raises(ValueError, match="speed"):
        normalize(PokeApiPokemon.model_validate(raw))


def test_rejects_malformed_responses() -> None:
    raw = load_fixture(25)
    del raw["types"]

    with pytest.raises(ValidationError):
        PokeApiPokemon.model_validate(raw)


def test_content_hash_is_stable_for_the_same_data() -> None:
    first = normalize(PokeApiPokemon.model_validate(load_fixture(25)))
    second = normalize(PokeApiPokemon.model_validate(load_fixture(25)))

    assert first.content_hash() == second.content_hash()
    assert len(first.content_hash()) == 64


@pytest.mark.parametrize(
    "change",
    [
        {"name": "raichu"},
        {"types": ("electric", "fairy")},
        {"speed": 91},
        {"sprite_url": None},
        {"is_default": False},
    ],
)
def test_content_hash_changes_when_any_tracked_field_changes(change: dict[str, Any]) -> None:
    record = normalize(PokeApiPokemon.model_validate(load_fixture(25)))

    assert replace(record, **change).content_hash() != record.content_hash()


@pytest.mark.parametrize("base_stat", [0, 256])
def test_rejects_base_stats_the_database_would_refuse(base_stat: int) -> None:
    raw = load_fixture(25)
    raw["stats"][0]["base_stat"] = base_stat

    with pytest.raises(ValueError, match="hp"):
        normalize(PokeApiPokemon.model_validate(raw))


def test_rejects_more_than_two_types() -> None:
    raw = load_fixture(6)
    raw["types"].append({"slot": 3, "type": {"name": "dragon", "url": ""}})

    with pytest.raises(ValueError, match="3 types"):
        normalize(PokeApiPokemon.model_validate(raw))
