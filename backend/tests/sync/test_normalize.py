from typing import Any

import pytest
from pydantic import ValidationError

from app.pokemon.enums import PokemonType
from app.pokemon.schemas import STAT_NAMES, Pokemon, Stats
from app.sync.constants import POKEAPI_STAT_NAMES
from app.sync.normalize import content_hash, normalize
from app.sync.schemas import PokeApiPokemon
from tests.support.pokeapi import pokemon_response
from tests.support.pokemon import with_columns


def test_normalizes_a_pokeapi_response() -> None:
    pokemon = normalize(PokeApiPokemon.model_validate(pokemon_response(25)))

    assert pokemon == Pokemon(
        id=25,
        name="pikachu",
        types=(PokemonType.ELECTRIC,),
        stats=Stats(hp=35, attack=55, defense=40, sp_attack=50, sp_defense=50, speed=90),
        sprite_url="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png",
        is_default=True,
    )


def test_orders_types_by_slot_not_list_position() -> None:
    raw = pokemon_response(6)
    raw["types"].reverse()

    pokemon = normalize(PokeApiPokemon.model_validate(raw))

    assert pokemon.types == ("fire", "flying")


def test_allows_a_missing_sprite() -> None:
    raw = pokemon_response(25)
    raw["sprites"]["front_default"] = None

    assert normalize(PokeApiPokemon.model_validate(raw)).sprite_url is None


def test_rejects_a_pokemon_missing_a_base_stat_in_one_line() -> None:
    raw = pokemon_response(25)
    raw["stats"] = [s for s in raw["stats"] if s["stat"]["name"] != "speed"]

    # The reason goes into the sync's log, one line per skipped Pokémon.
    with pytest.raises(ValueError, match=r"^stats\.speed: Field required$"):
        normalize(PokeApiPokemon.model_validate(raw))


def test_knows_pokeapis_name_for_every_stat() -> None:
    assert tuple(POKEAPI_STAT_NAMES) == STAT_NAMES


def test_rejects_malformed_responses() -> None:
    raw = pokemon_response(25)
    del raw["types"]

    with pytest.raises(ValidationError):
        PokeApiPokemon.model_validate(raw)


def test_content_hash_is_stable_for_the_same_data() -> None:
    first = normalize(PokeApiPokemon.model_validate(pokemon_response(25)))
    second = normalize(PokeApiPokemon.model_validate(pokemon_response(25)))

    assert content_hash(first) == content_hash(second)
    assert len(content_hash(first)) == 64


def test_content_hash_matches_the_hashes_already_stored() -> None:
    # Hashing the same data differently would make every stored Pokémon look updated on the next
    # sync, so the format is pinned to a hash the database already holds for Pikachu.
    pokemon = normalize(PokeApiPokemon.model_validate(pokemon_response(25)))

    assert (
        content_hash(pokemon) == "80cc73529f1e68881e42fea4a93806481c103522693b2633641b611c63c6fe17"
    )


@pytest.mark.parametrize(
    "change",
    [
        {"name": "raichu"},
        {"types": ["electric", "fairy"]},
        {"speed": 91},
        {"sprite_url": None},
        {"is_default": False},
    ],
)
def test_content_hash_changes_when_any_tracked_field_changes(change: dict[str, Any]) -> None:
    pokemon = normalize(PokeApiPokemon.model_validate(pokemon_response(25)))

    assert content_hash(with_columns(pokemon, **change)) != content_hash(pokemon)


@pytest.mark.parametrize("base_stat", [0, 256])
def test_rejects_base_stats_the_database_would_refuse(base_stat: int) -> None:
    raw = pokemon_response(25)
    raw["stats"][0]["base_stat"] = base_stat

    with pytest.raises(ValueError, match="hp"):
        normalize(PokeApiPokemon.model_validate(raw))


def test_rejects_more_than_two_types() -> None:
    raw = pokemon_response(6)
    raw["types"].append({"slot": 3, "type": {"name": "dragon", "url": ""}})

    with pytest.raises(ValueError, match="at most 2"):
        normalize(PokeApiPokemon.model_validate(raw))


def test_rejects_a_type_we_do_not_know() -> None:
    raw = pokemon_response(25)
    raw["types"][0]["type"]["name"] = "stellar"

    with pytest.raises(ValueError, match=r"^types\.0: Input should be 'normal'"):
        normalize(PokeApiPokemon.model_validate(raw))
