import json
from collections.abc import Callable, Coroutine
from pathlib import Path
from typing import Any

import anyio
import httpx2
import pytest

from app.sync.pokeapi import MAX_PAGES, PokeApiClient, PokeApiError

pytestmark = pytest.mark.anyio

BASE_URL = "https://pokeapi.test/api/v2/"
FIXTURES = Path(__file__).parent / "fixtures" / "pokeapi"

Handler = Callable[[httpx2.Request], Coroutine[None, None, httpx2.Response]]


def detail(pokemon_id: int) -> dict[str, Any]:
    data: dict[str, Any] = json.loads((FIXTURES / f"pokemon-{pokemon_id}.json").read_text())
    return data


def listing(*pokemon_ids: int, next_page: str | None = None) -> dict[str, Any]:
    return {
        "count": len(pokemon_ids),
        "next": next_page,
        "results": [
            {"name": str(pokemon_id), "url": f"{BASE_URL}pokemon/{pokemon_id}/"}
            for pokemon_id in pokemon_ids
        ],
    }


def make_client(handler: Handler, *, concurrency: int = 20) -> PokeApiClient:
    http = httpx2.AsyncClient(base_url=BASE_URL, transport=httpx2.MockTransport(handler))
    return PokeApiClient(http, concurrency=concurrency, retry_delay=0)


async def test_fetches_every_pokemon_in_the_listing() -> None:
    async def handler(request: httpx2.Request) -> httpx2.Response:
        if request.url.path.endswith("/pokemon"):
            return httpx2.Response(200, json=listing(6, 25))
        pokemon_id = int(request.url.path.rstrip("/").rsplit("/", 1)[1])
        return httpx2.Response(200, json=detail(pokemon_id))

    result = await make_client(handler).fetch_all()

    assert sorted(p.name for p in result.pokemon) == ["charizard", "pikachu"]
    assert result.failed == []


async def test_follows_pagination_through_every_page() -> None:
    page_two = f"{BASE_URL}pokemon?offset=1&limit=1"

    async def handler(request: httpx2.Request) -> httpx2.Response:
        if request.url.path.endswith("/pokemon"):
            if request.url.params.get("offset") == "1":
                return httpx2.Response(200, json=listing(25))
            return httpx2.Response(200, json=listing(6, next_page=page_two))
        pokemon_id = int(request.url.path.rstrip("/").rsplit("/", 1)[1])
        return httpx2.Response(200, json=detail(pokemon_id))

    result = await make_client(handler).fetch_all()

    assert sorted(p.name for p in result.pokemon) == ["charizard", "pikachu"]


async def test_retries_server_errors() -> None:
    calls = 0

    async def handler(request: httpx2.Request) -> httpx2.Response:
        nonlocal calls
        if request.url.path.endswith("/pokemon"):
            return httpx2.Response(200, json=listing(25))
        calls += 1
        if calls == 1:
            return httpx2.Response(503)
        return httpx2.Response(200, json=detail(25))

    result = await make_client(handler).fetch_all()

    assert [p.name for p in result.pokemon] == ["pikachu"]
    assert calls == 2


async def test_reports_pokemon_that_keep_failing_without_losing_the_rest() -> None:
    async def handler(request: httpx2.Request) -> httpx2.Response:
        if request.url.path.endswith("/pokemon"):
            return httpx2.Response(200, json=listing(6, 25))
        if request.url.path.rstrip("/").endswith("/6"):
            return httpx2.Response(500)
        return httpx2.Response(200, json=detail(25))

    result = await make_client(handler).fetch_all()

    assert [p.name for p in result.pokemon] == ["pikachu"]
    assert result.failed == [f"{BASE_URL}pokemon/6/"]


async def test_does_not_retry_client_errors() -> None:
    detail_calls = 0

    async def handler(request: httpx2.Request) -> httpx2.Response:
        nonlocal detail_calls
        if request.url.path.endswith("/pokemon"):
            return httpx2.Response(200, json=listing(25))
        detail_calls += 1
        return httpx2.Response(404)

    result = await make_client(handler).fetch_all()

    assert result.failed == [f"{BASE_URL}pokemon/25/"]
    assert detail_calls == 1


async def test_limits_how_many_requests_run_at_once() -> None:
    in_flight = 0
    peak = 0

    async def handler(request: httpx2.Request) -> httpx2.Response:
        nonlocal in_flight, peak
        if request.url.path.endswith("/pokemon"):
            return httpx2.Response(200, json=listing(*range(1, 11)))
        in_flight += 1
        peak = max(peak, in_flight)
        await anyio.sleep(0.01)
        in_flight -= 1
        return httpx2.Response(200, json=detail(25))

    result = await make_client(handler, concurrency=3).fetch_all()

    assert len(result.pokemon) == 10
    assert peak == 3


@pytest.mark.parametrize(
    "outside_url",
    [
        "http://169.254.169.254/latest/meta-data/",  # another host (a cloud metadata endpoint)
        "http://pokeapi.test/api/v2/pokemon/25/",  # same host, different scheme
        "https://pokeapi.test/admin/",  # same host, outside the API path
    ],
)
async def test_fails_when_the_listing_points_outside_pokeapi(outside_url: str) -> None:
    requested: list[str] = []

    async def handler(request: httpx2.Request) -> httpx2.Response:
        requested.append(str(request.url))
        if request.url.path.endswith("/pokemon"):
            results = [
                {"name": "pikachu", "url": f"{BASE_URL}pokemon/25/"},
                {"name": "outside", "url": outside_url},
            ]
            return httpx2.Response(200, json={"next": None, "results": results})
        return httpx2.Response(200, json=detail(25))

    with pytest.raises(PokeApiError, match="outside PokéAPI"):
        await make_client(handler).fetch_all()

    assert outside_url not in requested


@pytest.mark.parametrize(
    ("next_page", "reason"),
    [
        ("https://elsewhere.test/api/v2/pokemon?offset=1&limit=1", "outside PokéAPI"),
        (f"{BASE_URL}pokemon?offset=0&limit=1", "loops back"),
    ],
)
async def test_fails_rather_than_returning_a_partial_listing(next_page: str, reason: str) -> None:
    async def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(200, json=listing(25, next_page=next_page))

    with pytest.raises(PokeApiError, match=reason):
        await make_client(handler).fetch_all()


async def test_fails_when_the_listing_never_ends() -> None:
    async def handler(request: httpx2.Request) -> httpx2.Response:
        offset = int(request.url.params.get("offset", "0"))
        return httpx2.Response(
            200, json=listing(25, next_page=f"{BASE_URL}pokemon?offset={offset + 1}&limit=1")
        )

    with pytest.raises(PokeApiError, match=str(MAX_PAGES)):
        await make_client(handler).fetch_all()


async def test_fetches_a_pokemon_listed_twice_only_once() -> None:
    page_two = f"{BASE_URL}pokemon?offset=1&limit=1"
    detail_calls = 0

    async def handler(request: httpx2.Request) -> httpx2.Response:
        nonlocal detail_calls
        if request.url.path.endswith("/pokemon"):
            if request.url.params.get("offset") == "1":
                return httpx2.Response(200, json=listing(25))
            return httpx2.Response(200, json=listing(25, next_page=page_two))
        detail_calls += 1
        return httpx2.Response(200, json=detail(25))

    result = await make_client(handler).fetch_all()

    assert len(result.pokemon) == 1
    assert detail_calls == 1


async def test_reports_a_response_that_is_not_json() -> None:
    async def handler(request: httpx2.Request) -> httpx2.Response:
        if request.url.path.endswith("/pokemon"):
            return httpx2.Response(200, json=listing(6, 25))
        if request.url.path.rstrip("/").endswith("/6"):
            return httpx2.Response(200, text="<html>maintenance</html>")
        return httpx2.Response(200, json=detail(25))

    result = await make_client(handler).fetch_all()

    assert [p.name for p in result.pokemon] == ["pikachu"]
    assert result.failed == [f"{BASE_URL}pokemon/6/"]


async def test_reports_every_listed_pokemon_including_ones_that_failed() -> None:
    # Callers need this to tell "removed from PokéAPI" apart from "failed to fetch".
    async def handler(request: httpx2.Request) -> httpx2.Response:
        if request.url.path.endswith("/pokemon"):
            return httpx2.Response(200, json=listing(6, 25))
        if request.url.path.rstrip("/").endswith("/6"):
            return httpx2.Response(500)
        return httpx2.Response(200, json=detail(25))

    result = await make_client(handler).fetch_all()

    assert result.listed_ids == {6, 25}


async def test_fails_when_a_listing_url_has_no_pokemon_id() -> None:
    async def handler(request: httpx2.Request) -> httpx2.Response:
        results = [{"name": "odd", "url": f"{BASE_URL}pokemon/not-a-number/"}]
        return httpx2.Response(200, json={"next": None, "results": results})

    with pytest.raises(PokeApiError, match="no Pokémon id"):
        await make_client(handler).fetch_all()
