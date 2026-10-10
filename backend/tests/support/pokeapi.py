"""A fake PokéAPI for tests: recorded responses served through a mock transport.

Nothing here touches the network (and pytest-socket would fail the test if it tried).
"""

import json
from collections.abc import Callable, Coroutine
from pathlib import Path
from typing import Any

import httpx2

from app.sync.client import PokeApiClient

BASE_URL = "https://pokeapi.test/api/v2/"
RECORDED_RESPONSES = Path(__file__).parent / "pokeapi_responses"

Handler = Callable[[httpx2.Request], Coroutine[None, None, httpx2.Response]]


def pokemon_response(pokemon_id: int) -> dict[str, Any]:
    """A recorded GET /pokemon/{id} response; a fresh copy, so tests may modify it."""
    path = RECORDED_RESPONSES / f"pokemon-{pokemon_id}.json"
    data: dict[str, Any] = json.loads(path.read_text())
    return data


def pokemon_url(pokemon_id: int) -> str:
    return f"{BASE_URL}pokemon/{pokemon_id}/"


def listing_response(*pokemon_ids: int, next_page: str | None = None) -> dict[str, Any]:
    """A GET /pokemon page listing the given Pokémon."""
    results = [
        {"name": str(pokemon_id), "url": pokemon_url(pokemon_id)} for pokemon_id in pokemon_ids
    ]
    return {"count": len(pokemon_ids), "next": next_page, "results": results}


def requested_pokemon_id(request: httpx2.Request) -> int:
    return int(request.url.path.rstrip("/").rsplit("/", 1)[1])


def client_for(handler: Handler, *, concurrency: int = 20) -> PokeApiClient:
    """A real PokeApiClient whose requests are answered by `handler`, with no retry delays."""
    http = httpx2.AsyncClient(base_url=BASE_URL, transport=httpx2.MockTransport(handler))
    return PokeApiClient(http, concurrency=concurrency, retry_delay=0)


def fake_pokeapi(
    *,
    listing_status: int = 200,
    broken_id: int | None = None,
    speeds: dict[int, int] | None = None,
    extra_urls: tuple[str, ...] = (),
) -> PokeApiClient:
    """PokéAPI listing Charizard (6) and Pikachu (25), with optional failures and changes."""

    async def handler(request: httpx2.Request) -> httpx2.Response:
        if request.url.path.endswith("/pokemon"):
            listing = listing_response(6, 25)
            listing["results"] += [{"name": url, "url": url} for url in extra_urls]
            return httpx2.Response(listing_status, json=listing)
        pokemon_id = requested_pokemon_id(request)
        if pokemon_id == broken_id:
            return httpx2.Response(500)
        data = pokemon_response(pokemon_id)
        if speeds and pokemon_id in speeds:
            speed = next(s for s in data["stats"] if s["stat"]["name"] == "speed")
            speed["base_stat"] = speeds[pokemon_id]
        return httpx2.Response(200, json=data)

    return client_for(handler)
