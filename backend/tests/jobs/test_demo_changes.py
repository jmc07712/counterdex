from collections.abc import Callable
from typing import Any

import httpx2
import pytest
from sqlalchemy import Row, select
from sqlalchemy.orm import Session

from app.accounts import service as accounts
from app.jobs.demo_changes import ChangedPokeApi, Scenario
from app.jobs.sync_pokemon import sync_pokemon
from app.pokemon.enums import PokemonType
from app.sync.client import PokeApiClient
from app.sync.enums import ChangeKind
from app.sync.models import PokemonChange
from app.teams import queries as teams
from tests.support.accounts import ASH
from tests.support.pokeapi import (
    BASE_URL,
    fake_pokeapi,
    fake_pokeapi_handler,
    pokemon_response,
    species_response,
)
from tests.support.teams import make_team

pytestmark = pytest.mark.anyio

SCENARIO = Scenario(
    stat_changes={"charizard": {"attack": 20, "speed": 20}},
    new_types={"charizard": ("fire", "dragon")},
    delisted=frozenset({"pikachu"}),
)
# The fake PokéAPI's listing names Pokémon by id; the real one, which scenarios use, by name.
NAMES = {"6": "charizard", "25": "pikachu"}


def name_the_listing(path: str, data: dict[str, Any]) -> None:
    if path == "pokemon":
        for entry in data["results"]:
            entry["name"] = NAMES[entry["name"]]


def changed_http() -> httpx2.AsyncClient:
    """The fake PokéAPI as it is after SCENARIO."""
    inner = httpx2.MockTransport(fake_pokeapi_handler(edit=name_the_listing))
    return httpx2.AsyncClient(base_url=BASE_URL, transport=ChangedPokeApi(inner, SCENARIO))


def base_stats(pokemon: dict[str, Any]) -> dict[str, int]:
    return {stat["stat"]["name"]: stat["base_stat"] for stat in pokemon["stats"]}


def changes(sessions: Callable[[], Session]) -> list[Row[int, ChangeKind]]:
    """Every recorded change's Pokémon and kind, sync by sync."""
    with sessions() as session:
        return list(
            session.execute(
                select(PokemonChange.pokemon_id, PokemonChange.kind).order_by(
                    PokemonChange.sync_run_id, PokemonChange.pokemon_id
                )
            ).all()
        )


async def test_edits_the_pokemon_the_scenario_names_and_nothing_else() -> None:
    async with changed_http() as http:
        listing = (await http.get("pokemon")).json()
        charizard = (await http.get("pokemon/6/")).json()
        pikachu = (await http.get("pokemon/25/")).json()
        charizards_species = (await http.get("pokemon-species/6/")).json()

    assert [entry["name"] for entry in listing["results"]] == ["charizard"]
    before = base_stats(pokemon_response(6))
    assert base_stats(charizard) == before | {
        "attack": before["attack"] + 20,
        "speed": before["speed"] + 20,
    }
    assert [slot["type"]["name"] for slot in charizard["types"]] == ["fire", "dragon"]
    # Pikachu only leaves the listing, and a species named Charizard isn't a Pokémon.
    assert pikachu == pokemon_response(25)
    assert charizards_species == species_response(6)


async def test_the_sync_flags_the_changes_on_teams_until_pokeapi_changes_back(
    sessions: Callable[[], Session],
) -> None:
    await sync_pokemon(fake_pokeapi(), sessions)
    with sessions() as session:
        team_id = make_team(session, accounts.sign_up(session, ASH).user.id, 6, 25).id
        session.commit()

    assert await sync_pokemon(PokeApiClient(changed_http(), retry_delay=0), sessions) == 0

    assert changes(sessions) == [(6, ChangeKind.UPDATED), (25, ChangeKind.REMOVED)]
    with sessions() as session:
        charizard, pikachu = teams.get_team(session, team_id).members
    attack = base_stats(pokemon_response(6))["attack"]
    assert (charizard.pokemon.stats.attack, charizard.pokemon.types) == (
        attack + 20,
        (PokemonType.FIRE, PokemonType.DRAGON),
    )
    assert pikachu.removed_at is not None
    assert charizard.pokemon.changed_recently
    assert pikachu.pokemon.changed_recently

    # The ordinary sync puts PokéAPI's real data back, and records that too.
    assert await sync_pokemon(fake_pokeapi(), sessions) == 0

    assert changes(sessions)[2:] == [(6, ChangeKind.UPDATED), (25, ChangeKind.RESTORED)]
    with sessions() as session:
        charizard, pikachu = teams.get_team(session, team_id).members
    assert charizard.pokemon.stats.attack == attack
    assert pikachu.removed_at is None
