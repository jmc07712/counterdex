"""A fake PokéAPI for tests: recorded responses served through a mock transport.

Nothing here touches the network (and pytest-socket would fail the test if it tried).
"""

import json
from collections.abc import Callable, Collection, Coroutine, Mapping, Sequence
from pathlib import Path
from typing import Any

import httpx2

from app.sync.client import PokeApiClient
from app.sync.constants import POKEAPI_BASE_URL

BASE_URL = "https://pokeapi.test/api/v2/"
RECORDED_RESPONSES = Path(__file__).parent / "pokeapi_responses"
# Charmander's and Pichu's evolution families, whole.
SPECIES_IDS = (4, 5, 6, 172, 25, 26)

Handler = Callable[[httpx2.Request], Coroutine[None, None, httpx2.Response]]


def recorded_response(name: str) -> dict[str, Any]:
    """A recorded response, e.g. "pokemon-25", linking to the fake PokéAPI instead of the real
    one. A fresh copy, so tests may modify it.
    """
    text = (RECORDED_RESPONSES / f"{name}.json").read_text()
    data: dict[str, Any] = json.loads(text.replace(POKEAPI_BASE_URL, BASE_URL))
    return data


def pokemon_response(pokemon_id: int) -> dict[str, Any]:
    return recorded_response(f"pokemon-{pokemon_id}")


def species_response(species_id: int) -> dict[str, Any]:
    return recorded_response(f"pokemon-species-{species_id}")


def evolution_chain_response(chain_id: int) -> dict[str, Any]:
    return recorded_response(f"evolution-chain-{chain_id}")


def listing_response(
    *ids: int, next_page: str | None = None, resource: str = "pokemon"
) -> dict[str, Any]:
    """A GET /pokemon (or other resource) page listing the given ids."""
    results = [{"name": str(id_), "url": f"{BASE_URL}{resource}/{id_}/"} for id_ in ids]
    return {"count": len(ids), "next": next_page, "results": results}


def requested_id(request: httpx2.Request) -> int:
    return int(request.url.path.rstrip("/").rsplit("/", 1)[1])


def client_for(handler: Handler, *, concurrency: int = 20) -> PokeApiClient:
    """A real PokeApiClient whose requests are answered by `handler`, with no retry delays."""
    http = httpx2.AsyncClient(base_url=BASE_URL, transport=httpx2.MockTransport(handler))
    return PokeApiClient(http, concurrency=concurrency, retry_delay=0)


def fake_pokeapi(
    *,
    failing: Collection[str] = (),
    speeds: Mapping[int, int] | None = None,
    extra_urls: Sequence[str] = (),
    requested: list[str] | None = None,
    edit: Callable[[str, dict[str, Any]], None] | None = None,
) -> PokeApiClient:
    """PokéAPI listing Charizard (6) and Pikachu (25) and their evolution families' species.

    Requests for the `failing` paths, such as "pokemon/6" (or "pokemon" for the listing), get a
    server error every time. `speeds` changes Pokémon's speed by id, `extra_urls` are listed
    after the Pokémon, and every URL requested is added to `requested`. `edit` is called with
    each response's path, such as "pokemon-species/6", and its JSON, which it may change.
    """

    async def handler(request: httpx2.Request) -> httpx2.Response:
        if requested is not None:
            requested.append(str(request.url))
        path = request.url.path.removeprefix(httpx2.URL(BASE_URL).path).strip("/")
        if path in failing:
            return httpx2.Response(500)
        match path.split("/"):
            case ["pokemon"]:
                data = listing_response(6, 25)
                data["results"] += [{"name": url, "url": url} for url in extra_urls]
            case ["pokemon", pokemon_id]:
                data = pokemon_response(int(pokemon_id))
                if speeds and int(pokemon_id) in speeds:
                    speed = next(s for s in data["stats"] if s["stat"]["name"] == "speed")
                    speed["base_stat"] = speeds[int(pokemon_id)]
            case ["pokemon-species"]:
                data = listing_response(*SPECIES_IDS, resource="pokemon-species")
            case ["pokemon-species", species_id]:
                data = species_response(int(species_id))
            case ["evolution-chain", chain_id]:
                data = evolution_chain_response(int(chain_id))
            case _:
                return httpx2.Response(404)
        if edit is not None:
            edit(path, data)
        return httpx2.Response(200, json=data)

    return client_for(handler)
