from typing import Any

import pytest
from pydantic import ValidationError

from app.pokemon.enums import (
    EvolutionTrigger,
    Gender,
    PokemonType,
    RelativePhysicalStats,
    TimeOfDay,
)
from app.pokemon.schemas import STAT_NAMES, EvolutionMethod, Pokemon, Stats
from app.sync.constants import POKEAPI_STAT_NAMES
from app.sync.normalize import content_hash, normalize, normalize_species
from app.sync.pokeapi import EvolutionDetail, PokeApiEvolutionChain, PokeApiPokemon, PokeApiSpecies
from app.sync.types import SpeciesRecord
from tests.support.pokeapi import (
    SPECIES_IDS,
    evolution_chain_response,
    pokemon_response,
    species_response,
)
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


def fetched_families(
    *, without: tuple[int, ...] = ()
) -> tuple[list[PokeApiSpecies], list[PokeApiEvolutionChain]]:
    """Charmander's and Pichu's families as PokéAPI returns them, less the `without` species."""
    species = [
        PokeApiSpecies.model_validate(species_response(species_id))
        for species_id in SPECIES_IDS
        if species_id not in without
    ]
    chains = [
        PokeApiEvolutionChain.model_validate(evolution_chain_response(id_)) for id_ in (2, 10)
    ]
    return species, chains


def normalized_by_id(*, without: tuple[int, ...] = ()) -> dict[int, SpeciesRecord]:
    return {each.id: each for each in normalize_species(*fetched_families(without=without))}


def test_normalizes_a_species_and_its_place_in_its_family() -> None:
    assert normalized_by_id()[6] == SpeciesRecord(
        id=6,
        name="charizard",
        genus="Flame Pokémon",
        evolution_chain_id=2,
        evolves_from_species_id=5,
        evolution_methods=(EvolutionMethod(trigger=EvolutionTrigger.LEVEL_UP, min_level=36),),
        pokemon_ids=(6, 10034, 10035, 10196),
    )


def test_a_familys_first_stage_evolves_from_nothing() -> None:
    charmander = normalized_by_id()[4]

    assert (charmander.evolves_from_species_id, charmander.evolution_methods) == (None, ())


def test_keeps_every_way_to_evolve_in_the_latest_games() -> None:
    assert normalized_by_id()[26].evolution_methods == (
        EvolutionMethod(trigger=EvolutionTrigger.USE_ITEM, item="thunder-stone"),
        EvolutionMethod(trigger=EvolutionTrigger.USE_ITEM, item="thunder-stone", region="alola"),
    )


def test_normalizes_every_species_of_every_family_fetched_whole() -> None:
    assert sorted(normalized_by_id()) == sorted(SPECIES_IDS)


def test_leaves_out_a_family_missing_a_species() -> None:
    # Charmeleon (5) failed to fetch, so Charmander's family waits for the next sync.
    assert sorted(normalized_by_id(without=(5,))) == [25, 26, 172]


def method_from(detail: dict[str, Any]) -> EvolutionMethod:
    """The method PokéAPI's evolution detail describes, read into the app's terms."""
    return EvolutionDetail.model_validate(detail).method


def test_reads_pokeapis_names_and_ids_in_the_apps_terms() -> None:
    detail = {
        "trigger": {"name": "level-up", "url": "https://pokeapi.co/api/v2/evolution-trigger/1/"},
        "known_move_type": {"name": "fairy", "url": "https://pokeapi.co/api/v2/type/18/"},
        "time_of_day": "night",
        "gender": 1,
        "relative_physical_stats": -1,
        "condition_expression": {"expression": "EC 16 >> 10 % 4 <=", "percentage_chance": 50},
        "version_group": {"name": "x-y", "url": "https://pokeapi.co/api/v2/version-group/15/"},
    }

    assert method_from(detail) == EvolutionMethod(
        trigger=EvolutionTrigger.LEVEL_UP,
        known_move_type=PokemonType.FAIRY,
        time_of_day=TimeOfDay.NIGHT,
        gender=Gender.FEMALE,
        relative_physical_stats=RelativePhysicalStats.DEFENSE_HIGHER,
        chance=50,
    )


def test_reads_pokeapis_blank_time_of_day_as_any_time() -> None:
    assert method_from({"trigger": {"name": "trade"}, "time_of_day": ""}).time_of_day is None


def test_rejects_a_trigger_the_app_does_not_know() -> None:
    with pytest.raises(ValidationError, match="trigger"):
        method_from({"trigger": {"name": "some-new-trigger"}})


def test_rejects_an_id_the_app_does_not_know() -> None:
    # Rather than read it as "any gender".
    with pytest.raises(ValidationError, match="gender"):
        method_from({"trigger": {"name": "level-up"}, "gender": 3})


def test_describes_only_the_latest_games_ways_when_pokeapi_marks_them() -> None:
    species, chains = fetched_families()
    charmeleon_link = chains[0].chain.evolves_to[0]
    older = {"trigger": {"name": "trade"}, "is_default": False}
    charmeleon_link.evolution_details.append(EvolutionDetail.model_validate(older))

    charmeleon = {each.id: each for each in normalize_species(species, chains)}[5]

    assert charmeleon.evolution_methods == (
        EvolutionMethod(trigger=EvolutionTrigger.LEVEL_UP, min_level=16),
    )


def test_lists_each_way_to_evolve_once() -> None:
    species, chains = fetched_families()
    charmeleon_link = chains[0].chain.evolves_to[0]
    charmeleon_link.evolution_details.append(charmeleon_link.evolution_details[0])

    charmeleon = {each.id: each for each in normalize_species(species, chains)}[5]

    assert len(charmeleon.evolution_methods) == 1
