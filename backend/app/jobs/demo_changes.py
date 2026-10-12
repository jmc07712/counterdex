"""Job: sync from a PokéAPI that has changed, to show what users see when it does.

uv run --env-file ../.env python -m app.jobs.demo_changes [--not-local]

PokéAPI rarely changes, so this runs the real sync against PokéAPI's real responses, edited on
their way in as if PokéAPI had changed: Charizard's Attack and Speed go up, Gengar becomes
Ghost/Fairy, Pikachu leaves the listing, and Garchomp, Snorlax, Lucario and Dragonite get smaller
stat changes. The sync detects and records these like any other change, and every team with one
of them on it says so for a week.

Run the ordinary sync afterwards to put PokéAPI's real data back. That records the reverse too:
the six change back, and Pikachu is restored.

It refuses a database that isn't on this machine unless given --not-local, which demos a deployed
app. That database keeps the made-up changes in its history, and shows the made-up data until the
next ordinary sync.
"""

import argparse
import logging
import re
import sys
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

import anyio
import httpx2

from app.jobs import sync_pokemon
from app.jobs.local import is_local_database
from app.sync.constants import POKEAPI_BASE_URL

logger = logging.getLogger(__name__)

# GET /pokemon (the listing) and GET /pokemon/{id}, but not /pokemon-species.
POKEMON_PATH = re.compile(r"/pokemon(/\d+)?/?$")


@dataclass(frozen=True)
class Scenario:
    """How PokéAPI has changed, by the names it gives the Pokémon."""

    # Added to base stats, by PokéAPI's stat names such as "special-attack".
    stat_changes: Mapping[str, Mapping[str, int]] = field(default_factory=dict)
    # The Pokémon's types from now on, in slot order.
    new_types: Mapping[str, tuple[str, ...]] = field(default_factory=dict)
    # No longer in the listing, so the sync marks them removed.
    delisted: frozenset[str] = frozenset()


DEMO = Scenario(
    stat_changes={
        "charizard": {"attack": 20, "speed": 20},
        "garchomp": {"attack": -10},
        "snorlax": {"defense": 15},
        "lucario": {"special-attack": 10, "speed": 5},
        "dragonite": {"speed": 10},
    },
    new_types={"gengar": ("ghost", "fairy")},
    delisted=frozenset({"pikachu"}),
)


class ChangedPokeApi(httpx2.AsyncBaseTransport):
    """Sends requests on to `inner` (PokéAPI) and edits the Pokémon in what comes back."""

    def __init__(self, inner: httpx2.AsyncBaseTransport, scenario: Scenario) -> None:
        self._inner = inner
        self._scenario = scenario

    async def handle_async_request(self, request: httpx2.Request) -> httpx2.Response:
        response = await self._inner.handle_async_request(request)
        if response.status_code != httpx2.codes.OK or not POKEMON_PATH.search(request.url.path):
            return response
        await response.aread()
        await response.aclose()
        data = response.json()
        self._edit(data)
        return httpx2.Response(response.status_code, json=data, request=request)

    async def aclose(self) -> None:
        await self._inner.aclose()

    def _edit(self, data: dict[str, Any]) -> None:
        if "results" in data:
            data["results"] = [
                entry for entry in data["results"] if entry["name"] not in self._scenario.delisted
            ]
            return
        changes = self._scenario.stat_changes.get(data["name"], {})
        for stat in data["stats"]:
            stat["base_stat"] += changes.get(stat["stat"]["name"], 0)
        if (types := self._scenario.new_types.get(data["name"])) is not None:
            data["types"] = [
                {"slot": slot, "type": {"name": name, "url": f"{POKEAPI_BASE_URL}type/{name}/"}}
                for slot, name in enumerate(types, start=1)
            ]


async def main(not_local: bool) -> int:
    if not is_local_database():
        if not not_local:
            logger.error(
                "Refusing to make up changes in a database that isn't on this machine. "
                "Pass --not-local to demo a deployed app."
            )
            return 1
        logger.warning("Making up changes in a database that isn't on this machine.")
    logger.info(
        "Syncing as if PokéAPI changed: Charizard gains Attack and Speed, Gengar becomes "
        "Ghost/Fairy, Pikachu leaves the listing, and Garchomp, Snorlax, Lucario and Dragonite "
        "get smaller stat changes."
    )
    return await sync_pokemon.main(transport=ChangedPokeApi(httpx2.AsyncHTTPTransport(), DEMO))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        prog="python -m app.jobs.demo_changes",
        description="Sync as if PokéAPI had changed, to show what users see when it does.",
    )
    parser.add_argument(
        "--not-local",
        action="store_true",
        help="Allow a database that isn't on this machine, such as a deployed app's.",
    )
    arguments = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    # httpx2 logs every request at INFO; one line per Pokémon would bury the summary.
    logging.getLogger("httpx2").setLevel(logging.WARNING)
    sys.exit(anyio.run(main, arguments.not_local))
