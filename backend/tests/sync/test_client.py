import anyio
import httpx2
import pytest
from pydantic import ValidationError

from app.pokemon.enums import PokemonType
from app.sync.constants import MAX_PAGES
from app.sync.exceptions import PokeApiError
from tests.support.pokeapi import (
    BASE_URL,
    SPECIES_IDS,
    Handler,
    client_for,
    fake_pokeapi,
    listing_response,
    pokemon_response,
    requested_id,
    species_response,
)

pytestmark = pytest.mark.anyio


async def test_fetches_every_pokemon_in_the_listing() -> None:
    result = await fake_pokeapi().fetch_pokemon()

    assert sorted(p.name for p in result.pokemon) == ["charizard", "pikachu"]
    assert result.failed == []


def listed_on_two_pages(first: int, second: int, *, requested: list[str] | None = None) -> Handler:
    """PokéAPI listing Pokémon `first` on one page and `second` on the next; every URL
    requested is added to `requested`.
    """
    page_two = f"{BASE_URL}pokemon?offset=1&limit=1"

    async def handler(request: httpx2.Request) -> httpx2.Response:
        if requested is not None:
            requested.append(str(request.url))
        if request.url.path.endswith("/pokemon"):
            if request.url.params.get("offset") == "1":
                return httpx2.Response(200, json=listing_response(second))
            return httpx2.Response(200, json=listing_response(first, next_page=page_two))
        return httpx2.Response(200, json=pokemon_response(requested_id(request)))

    return handler


async def test_follows_pagination_through_every_page() -> None:
    result = await client_for(listed_on_two_pages(6, 25)).fetch_pokemon()

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


@pytest.mark.parametrize(
    ("status", "body"),
    [
        pytest.param(500, b"", id="server-error"),
        pytest.param(200, b"<html>maintenance</html>", id="not-json"),
        pytest.param(200, b'{"id": 6, "name": "charizard"}', id="not-a-pokemon"),
    ],
)
async def test_reports_pokemon_it_cannot_fetch_without_losing_the_rest(
    status: int, body: bytes
) -> None:
    async def handler(request: httpx2.Request) -> httpx2.Response:
        if request.url.path.endswith("/pokemon"):
            return httpx2.Response(200, json=listing_response(6, 25))
        if requested_id(request) == 6:
            return httpx2.Response(status, content=body)
        return httpx2.Response(200, json=pokemon_response(25))

    result = await client_for(handler).fetch_pokemon()

    assert [p.name for p in result.pokemon] == ["pikachu"]
    assert result.failed == [f"{BASE_URL}pokemon/6/"]


async def test_reports_every_listed_pokemon_including_ones_that_failed() -> None:
    # Callers need this to tell "removed from PokéAPI" apart from "failed to fetch".
    result = await fake_pokeapi(failing=("pokemon/6",)).fetch_pokemon()

    assert result.listed_ids == {6, 25}


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
    pokeapi = fake_pokeapi(extra_urls=(outside_url,), requested=requested)

    with pytest.raises(PokeApiError, match="outside PokéAPI"):
        await pokeapi.fetch_pokemon()

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
    # Offset paging can list a Pokémon on two pages if PokéAPI changes while it's read.
    requested: list[str] = []

    result = await client_for(listed_on_two_pages(25, 25, requested=requested)).fetch_pokemon()

    assert [p.name for p in result.pokemon] == ["pikachu"]
    assert requested.count(f"{BASE_URL}pokemon/25/") == 1


async def test_fails_when_a_listing_url_has_no_id() -> None:
    async def handler(request: httpx2.Request) -> httpx2.Response:
        results = [{"name": "odd", "url": f"{BASE_URL}pokemon/not-a-number/"}]
        return httpx2.Response(200, json={"next": None, "results": results})

    with pytest.raises(ValidationError, match="has no id"):
        await client_for(handler).fetch_pokemon()


async def test_fetches_every_species_and_their_evolution_chain_once() -> None:
    requested: list[str] = []

    result = await fake_pokeapi(requested=requested).fetch_species()

    assert sorted(s.id for s in result.species) == sorted(SPECIES_IDS)
    assert sorted(chain.id for chain in result.evolution_chains) == [2, 10]
    # Three species link to each chain.
    chain_requests = [url for url in requested if "/evolution-chain/" in url]
    assert sorted(chain_requests) == sorted(f"{BASE_URL}evolution-chain/{id_}/" for id_ in (2, 10))
    assert result.failed == []


async def test_reports_species_that_keep_failing_without_losing_the_rest() -> None:
    result = await fake_pokeapi(failing=("pokemon-species/5",)).fetch_species()

    assert sorted(s.id for s in result.species) == [4, 6, 25, 26, 172]
    assert result.failed == [f"{BASE_URL}pokemon-species/5/"]


async def test_reports_an_evolution_chain_that_keeps_failing() -> None:
    result = await fake_pokeapi(failing=("evolution-chain/2",)).fetch_species()

    assert len(result.species) == 6
    assert [chain.id for chain in result.evolution_chains] == [10]
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


async def test_fetches_every_type_the_app_knows_once() -> None:
    requested: list[str] = []

    result = await fake_pokeapi(requested=requested).fetch_types()

    assert sorted(each.name for each in result.types) == sorted(PokemonType)
    assert sorted(requested) == sorted(f"{BASE_URL}type/{type_}/" for type_ in PokemonType)
    assert result.failed == []


async def test_reports_a_type_that_keeps_failing_without_losing_the_rest() -> None:
    result = await fake_pokeapi(failing=("type/fire",)).fetch_types()

    assert sorted(each.name for each in result.types) == sorted(
        type_ for type_ in PokemonType if type_ is not PokemonType.FIRE
    )
    assert result.failed == [f"{BASE_URL}type/fire/"]
