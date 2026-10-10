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
from app.pokemon.schemas import EvolutionMethod, Pokemon
from app.sync.normalize import content_hash, normalize, normalize_species
from app.sync.pokeapi import (
    ChainLink,
    EvolutionDetail,
    PokeApiEvolutionChain,
    PokeApiPokemon,
    PokeApiSpecies,
)
from app.sync.types import SpeciesRecord
from tests.support.pokeapi import (
    SPECIES_IDS,
    evolution_chain_response,
    pokemon_response,
    species_response,
)
from tests.support.pokemon import LEVEL_16, LEVEL_36, PIKACHU, with_columns


def normalized(raw: dict[str, Any]) -> Pokemon:
    """A PokéAPI response for one Pokémon, read and normalized as the sync does."""
    return normalize(PokeApiPokemon.model_validate(raw))


def test_normalizes_a_pokeapi_response() -> None:
    assert normalized(pokemon_response(25)) == PIKACHU


def test_orders_types_by_slot_not_list_position() -> None:
    raw = pokemon_response(6)
    raw["types"].reverse()

    assert normalized(raw).types == ("fire", "flying")


def test_allows_a_missing_sprite() -> None:
    raw = pokemon_response(25)
    raw["sprites"]["front_default"] = None

    assert normalized(raw).sprite_url is None


def test_rejects_a_pokemon_missing_a_base_stat_in_one_line() -> None:
    raw = pokemon_response(25)
    raw["stats"] = [s for s in raw["stats"] if s["stat"]["name"] != "speed"]

    # The reason goes into the sync's log, one line per skipped Pokémon.
    with pytest.raises(ValueError, match=r"^stats\.speed: Field required$"):
        normalized(raw)


def test_content_hash_matches_the_hashes_already_stored() -> None:
    # Hashing the same data differently would make every stored Pokémon look updated on the next
    # sync, so the format is pinned to a hash the database already holds for Pikachu.
    assert content_hash(PIKACHU) == (
        "80cc73529f1e68881e42fea4a93806481c103522693b2633641b611c63c6fe17"
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
    assert content_hash(with_columns(PIKACHU, **change)) != content_hash(PIKACHU)


# --- Species ---


@pytest.fixture
def species() -> list[PokeApiSpecies]:
    """Every species of Charmander's and Pichu's evolution families, as PokéAPI returns them."""
    return [PokeApiSpecies.model_validate(species_response(id_)) for id_ in SPECIES_IDS]


@pytest.fixture
def chains() -> list[PokeApiEvolutionChain]:
    """Charmander's (2) and Pichu's (10) evolution chains, as PokéAPI returns them."""
    return [PokeApiEvolutionChain.model_validate(evolution_chain_response(id_)) for id_ in (2, 10)]


@pytest.fixture
def charmeleon_link(chains: list[PokeApiEvolutionChain]) -> ChainLink:
    """Charmeleon's place in Charmander's evolution chain, for tests to change."""
    return chains[0].chain.evolves_to[0]


def by_id(
    species: list[PokeApiSpecies], chains: list[PokeApiEvolutionChain]
) -> dict[int, SpeciesRecord]:
    """The normalized species, by id."""
    return {each.id: each for each in normalize_species(species, chains)}


def test_normalizes_a_species_and_its_place_in_its_family(
    species: list[PokeApiSpecies], chains: list[PokeApiEvolutionChain]
) -> None:
    assert by_id(species, chains)[6] == SpeciesRecord(
        id=6,
        name="charizard",
        genus="Flame Pokémon",
        evolution_chain_id=2,
        evolves_from_species_id=5,
        evolution_methods=(LEVEL_36,),
        pokemon_ids=(6, 10034, 10035, 10196),
    )


def test_a_familys_first_stage_evolves_from_nothing(
    species: list[PokeApiSpecies], chains: list[PokeApiEvolutionChain]
) -> None:
    charmander = by_id(species, chains)[4]

    assert (charmander.evolves_from_species_id, charmander.evolution_methods) == (None, ())


def test_keeps_every_way_to_evolve_in_the_latest_games(
    species: list[PokeApiSpecies], chains: list[PokeApiEvolutionChain]
) -> None:
    assert by_id(species, chains)[26].evolution_methods == (
        EvolutionMethod(trigger=EvolutionTrigger.USE_ITEM, item="thunder-stone"),
        EvolutionMethod(trigger=EvolutionTrigger.USE_ITEM, item="thunder-stone", region="alola"),
    )


def test_normalizes_every_species_of_every_family_fetched_whole(
    species: list[PokeApiSpecies], chains: list[PokeApiEvolutionChain]
) -> None:
    assert sorted(by_id(species, chains)) == sorted(SPECIES_IDS)


def test_leaves_out_a_family_missing_a_species(
    species: list[PokeApiSpecies], chains: list[PokeApiEvolutionChain]
) -> None:
    # Charmeleon (5) failed to fetch, so Charmander's family waits for the next sync.
    without_charmeleon = [each for each in species if each.id != 5]

    assert sorted(by_id(without_charmeleon, chains)) == [25, 26, 172]


def test_describes_only_the_latest_games_ways_when_pokeapi_marks_them(
    species: list[PokeApiSpecies],
    chains: list[PokeApiEvolutionChain],
    charmeleon_link: ChainLink,
) -> None:
    older = {"trigger": {"name": "trade"}, "is_default": False}
    charmeleon_link.evolution_details.append(EvolutionDetail.model_validate(older))

    assert by_id(species, chains)[5].evolution_methods == (LEVEL_16,)


def test_lists_each_way_to_evolve_once(
    species: list[PokeApiSpecies],
    chains: list[PokeApiEvolutionChain],
    charmeleon_link: ChainLink,
) -> None:
    charmeleon_link.evolution_details.append(charmeleon_link.evolution_details[0])

    assert by_id(species, chains)[5].evolution_methods == (LEVEL_16,)


# --- Evolution details ---


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


@pytest.mark.parametrize(
    ("detail", "field"),
    [
        pytest.param({"trigger": {"name": "some-new-trigger"}}, "trigger", id="trigger"),
        # Rather than read it as "any gender".
        pytest.param({"trigger": {"name": "level-up"}, "gender": 3}, "gender", id="gender-id"),
    ],
)
def test_rejects_what_the_app_does_not_know(detail: dict[str, Any], field: str) -> None:
    with pytest.raises(ValidationError, match=field):
        method_from(detail)
