import anyio
import httpx2
import pytest
from pydantic import ValidationError

from app.sync.constants import MAX_PAGES
from app.sync.exceptions import PokeApiError
from tests.support.pokeapi import (
    BASE_URL,
    Handler,
    client_for,
    evolution_chain_response,
    listing_response,
    pokemon_response,
    requested_id,
    species_response,
)

pytestmark = pytest.mark.anyio


async def test_fetches_every_pokemon_in_the_listing() -> None:
    async def handler(request: httpx2.Request) -> httpx2.Response:
        if request.url.path.endswith("/pokemon"):
            return httpx2.Response(200, json=listing_response(6, 25))
        pokemon_id = requested_id(request)
        return httpx2.Response(200, json=pokemon_response(pokemon_id))

    result = await client_for(handler).fetch_pokemon()

    assert sorted(p.name for p in result.pokemon) == ["charizard", "pikachu"]
    assert result.failed == []


async def test_follows_pagination_through_every_page() -> None:
    page_two = f"{BASE_URL}pokemon?offset=1&limit=1"

    async def handler(request: httpx2.Request) -> httpx2.Response:
        if request.url.path.endswith("/pokemon"):
            if request.url.params.get("offset") == "1":
                return httpx2.Response(200, json=listing_response(25))
            return httpx2.Response(200, json=listing_response(6, next_page=page_two))
        pokemon_id = requested_id(request)
        return httpx2.Response(200, json=pokemon_response(pokemon_id))

    result = await client_for(handler).fetch_pokemon()

    assert sorted(p.name for p in result.pokemon) == ["charizard", "pikachu"]


async def test_retries_server_errors() -> None:
    calls = 0

    async def handler(request: httpx2.Request) -> httpx2.Response:
        nonlocal calls
        if request.url.path.endswith("/pokemon"):
            return httpx2.Response(200, json=listing_response(25))
        calls += 1
        if calls == 1:
            return httpx2.Response(503)
        return httpx2.Response(200, json=pokemon_response(25))

    result = await client_for(handler).fetch_pokemon()

    assert [p.name for p in result.pokemon] == ["pikachu"]
    assert calls == 2


async def test_reports_pokemon_that_keep_failing_without_losing_the_rest() -> None:
    async def handler(request: httpx2.Request) -> httpx2.Response:
        if request.url.path.endswith("/pokemon"):
            return httpx2.Response(200, json=listing_response(6, 25))
        if request.url.path.rstrip("/").endswith("/6"):
            return httpx2.Response(500)
        return httpx2.Response(200, json=pokemon_response(25))

    result = await client_for(handler).fetch_pokemon()

    assert [p.name for p in result.pokemon] == ["pikachu"]
    assert result.failed == [f"{BASE_URL}pokemon/6/"]


async def test_does_not_retry_client_errors() -> None:
    detail_calls = 0

    async def handler(request: httpx2.Request) -> httpx2.Response:
        nonlocal detail_calls
        if request.url.path.endswith("/pokemon"):
            return httpx2.Response(200, json=listing_response(25))
        detail_calls += 1
        return httpx2.Response(404)

    result = await client_for(handler).fetch_pokemon()

    assert result.failed == [f"{BASE_URL}pokemon/25/"]
    assert detail_calls == 1


async def test_limits_how_many_requests_run_at_once() -> None:
    in_flight = 0
    peak = 0

    async def handler(request: httpx2.Request) -> httpx2.Response:
        nonlocal in_flight, peak
        if request.url.path.endswith("/pokemon"):
            return httpx2.Response(200, json=listing_response(*range(1, 11)))
        in_flight += 1
        peak = max(peak, in_flight)
        await anyio.sleep(0.01)
        in_flight -= 1
        return httpx2.Response(200, json=pokemon_response(25))

    result = await client_for(handler, concurrency=3).fetch_pokemon()

    assert len(result.pokemon) == 10
    assert peak == 3


# Each ends in an id, as a listing entry must, so it reaches the check on where it points.
@pytest.mark.parametrize(
    "outside_url",
    [
        "http://169.254.169.254/latest/meta-data/1/",  # another host (a cloud metadata endpoint)
        "http://pokeapi.test/api/v2/pokemon/25/",  # same host, different scheme
        "https://pokeapi.test/admin/1/",  # same host, outside the API path
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
        return httpx2.Response(200, json=pokemon_response(25))

    with pytest.raises(PokeApiError, match="outside PokéAPI"):
        await client_for(handler).fetch_pokemon()

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
        return httpx2.Response(200, json=listing_response(25, next_page=next_page))

    with pytest.raises(PokeApiError, match=reason):
        await client_for(handler).fetch_pokemon()


async def test_fails_when_the_listing_never_ends() -> None:
    async def handler(request: httpx2.Request) -> httpx2.Response:
        offset = int(request.url.params.get("offset", "0"))
        return httpx2.Response(
            200,
            json=listing_response(25, next_page=f"{BASE_URL}pokemon?offset={offset + 1}&limit=1"),
        )

    with pytest.raises(PokeApiError, match=str(MAX_PAGES)):
        await client_for(handler).fetch_pokemon()


async def test_fetches_a_pokemon_listed_twice_only_once() -> None:
    page_two = f"{BASE_URL}pokemon?offset=1&limit=1"
    detail_calls = 0

    async def handler(request: httpx2.Request) -> httpx2.Response:
        nonlocal detail_calls
        if request.url.path.endswith("/pokemon"):
            if request.url.params.get("offset") == "1":
                return httpx2.Response(200, json=listing_response(25))
            return httpx2.Response(200, json=listing_response(25, next_page=page_two))
        detail_calls += 1
        return httpx2.Response(200, json=pokemon_response(25))

    result = await client_for(handler).fetch_pokemon()

    assert len(result.pokemon) == 1
    assert detail_calls == 1


async def test_reports_a_response_that_is_not_json() -> None:
    async def handler(request: httpx2.Request) -> httpx2.Response:
        if request.url.path.endswith("/pokemon"):
            return httpx2.Response(200, json=listing_response(6, 25))
        if request.url.path.rstrip("/").endswith("/6"):
            return httpx2.Response(200, text="<html>maintenance</html>")
        return httpx2.Response(200, json=pokemon_response(25))

    result = await client_for(handler).fetch_pokemon()

    assert [p.name for p in result.pokemon] == ["pikachu"]
    assert result.failed == [f"{BASE_URL}pokemon/6/"]


async def test_reports_every_listed_pokemon_including_ones_that_failed() -> None:
    # Callers need this to tell "removed from PokéAPI" apart from "failed to fetch".
    async def handler(request: httpx2.Request) -> httpx2.Response:
        if request.url.path.endswith("/pokemon"):
            return httpx2.Response(200, json=listing_response(6, 25))
        if request.url.path.rstrip("/").endswith("/6"):
            return httpx2.Response(500)
        return httpx2.Response(200, json=pokemon_response(25))

    result = await client_for(handler).fetch_pokemon()

    assert result.listed_ids == {6, 25}


async def test_fails_when_a_listing_url_has_no_id() -> None:
    async def handler(request: httpx2.Request) -> httpx2.Response:
        results = [{"name": "odd", "url": f"{BASE_URL}pokemon/not-a-number/"}]
        return httpx2.Response(200, json={"next": None, "results": results})

    with pytest.raises(ValidationError, match="has no id"):
        await client_for(handler).fetch_pokemon()


def species_handler(*, failing: tuple[str, ...] = ()) -> Handler:
    """PokéAPI listing Charmander's family (4, 5, 6); requests to the `failing` paths fail."""

    async def handler(request: httpx2.Request) -> httpx2.Response:
        path = request.url.path.rstrip("/")
        if path.endswith(failing) and failing:
            return httpx2.Response(500)
        if path.endswith("/pokemon-species"):
            return httpx2.Response(200, json=listing_response(4, 5, 6, resource="pokemon-species"))
        if "/evolution-chain/" in path:
            return httpx2.Response(200, json=evolution_chain_response(requested_id(request)))
        return httpx2.Response(200, json=species_response(requested_id(request)))

    return handler


async def test_fetches_every_species_and_their_evolution_chain_once() -> None:
    chain_requests: list[str] = []
    handler = species_handler()

    async def counting(request: httpx2.Request) -> httpx2.Response:
        if "/evolution-chain/" in request.url.path:
            chain_requests.append(str(request.url))
        return await handler(request)

    result = await client_for(counting).fetch_species()

    assert sorted(s.name for s in result.species) == ["charizard", "charmander", "charmeleon"]
    assert [chain.id for chain in result.evolution_chains] == [2]
    assert chain_requests == [f"{BASE_URL}evolution-chain/2/"]
    assert result.failed == []


async def test_reports_species_that_keep_failing_without_losing_the_rest() -> None:
    result = await client_for(species_handler(failing=("pokemon-species/5",))).fetch_species()

    assert sorted(s.name for s in result.species) == ["charizard", "charmander"]
    assert result.failed == [f"{BASE_URL}pokemon-species/5/"]


async def test_reports_an_evolution_chain_that_keeps_failing() -> None:
    result = await client_for(species_handler(failing=("evolution-chain/2",))).fetch_species()

    assert len(result.species) == 3
    assert result.evolution_chains == []
    assert result.failed == [f"{BASE_URL}evolution-chain/2/"]


async def test_fails_when_a_species_links_to_an_evolution_chain_outside_pokeapi() -> None:
    outside_url = "https://elsewhere.test/api/v2/evolution-chain/2/"
    requested: list[str] = []

    async def handler(request: httpx2.Request) -> httpx2.Response:
        requested.append(str(request.url))
        if request.url.path.endswith("/pokemon-species"):
            return httpx2.Response(200, json=listing_response(6, resource="pokemon-species"))
        species = species_response(6)
        species["evolution_chain"]["url"] = outside_url
        return httpx2.Response(200, json=species)

    with pytest.raises(PokeApiError, match="outside PokéAPI"):
        await client_for(handler).fetch_species()

    assert outside_url not in requested
