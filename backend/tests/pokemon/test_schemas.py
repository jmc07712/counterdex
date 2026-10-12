from typing import Any

import pytest
from pydantic import ValidationError

from app.pokemon.enums import PokemonForm, PokemonType
from app.pokemon.schemas import Pokemon, PokemonQuery, Stats
from tests.support.pokemon import GYARADOS_SPRITE, gyarados_columns

GYARADOS = Pokemon(
    id=130,
    name="gyarados",
    types=(PokemonType.WATER, PokemonType.FLYING),
    stats=Stats(hp=95, attack=125, defense=79, sp_attack=60, sp_defense=100, speed=81),
    sprite_url=GYARADOS_SPRITE,
    is_default=True,
)


def test_gives_each_stat_its_own_column() -> None:
    assert GYARADOS.to_columns() == gyarados_columns()


def test_reads_a_pokemon_back_from_its_row() -> None:
    # A row also holds the sync's bookkeeping, which isn't part of the Pokémon.
    row = gyarados_columns() | {"content_hash": "0" * 64, "removed_at": None}

    assert Pokemon.from_columns(row) == GYARADOS


@pytest.mark.parametrize(
    ("columns", "field"),
    [
        pytest.param({"types": []}, "types", id="no-types"),
        pytest.param({"types": ["water", "flying", "dragon"]}, "types", id="three-types"),
        pytest.param({"types": ["water", "shadow"]}, r"types\.1", id="unknown-type"),
        pytest.param({"hp": 0}, "hp", id="base-stat-below-1"),
        pytest.param({"hp": 256}, "hp", id="base-stat-above-255"),
    ],
)
def test_rejects_a_pokemon_with_impossible_types_or_stats(
    columns: dict[str, Any], field: str
) -> None:
    # The sync then skips just this Pokémon, before the table would refuse it.
    with pytest.raises(ValidationError, match=field):
        Pokemon.from_columns(gyarados_columns() | columns)


def test_searches_names_as_they_are_stored() -> None:
    assert PokemonQuery(q="  Charizard Mega X ").q == "charizard-mega-x"


@pytest.mark.parametrize(
    ("name", "form"),
    [
        ("charizard-mega-x", PokemonForm.MEGA),
        ("charizard-gmax", PokemonForm.GIGANTAMAX),
        ("raichu-alola", PokemonForm.ALOLAN),
        ("zigzagoon-galar", PokemonForm.GALARIAN),
        ("growlithe-hisui", PokemonForm.HISUIAN),
        ("tauros-paldea-combat-breed", PokemonForm.PALDEAN),
        ("pikachu-rock-star", PokemonForm.OTHER),
    ],
)
def test_says_which_kind_of_alternate_form_it_is(name: str, form: PokemonForm) -> None:
    pokemon = Pokemon.from_columns(gyarados_columns() | {"name": name, "is_default": False})

    assert pokemon.form is form


def test_a_default_form_has_no_form_kind() -> None:
    assert GYARADOS.form is None


def test_the_form_kind_always_comes_from_the_name() -> None:
    pokemon = GYARADOS.model_validate(GYARADOS.model_dump() | {"form": PokemonForm.MEGA})

    assert pokemon.form is None
