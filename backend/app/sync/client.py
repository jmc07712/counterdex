"""HTTP client for PokéAPI. Knows nothing about our database."""

import logging
from collections.abc import Iterable

import anyio
import httpx2
from pydantic import BaseModel

from app.pokemon.enums import PokemonType
from app.sync.constants import (
    CONCURRENT_REQUESTS,
    MAX_ATTEMPTS,
    MAX_PAGES,
    MAX_RETRY_AFTER_DIGITS,
    MAX_RETRY_AFTER_SECONDS,
    PAGE_SIZE,
    RETRY_AFTER_STATUS_CODES,
    RETRY_DELAY_SECONDS,
    RETRYABLE_STATUS_CODES,
)
from app.sync.exceptions import PokeApiError
from app.sync.pokeapi import (
    NamedApiResource,
    PokeApiEvolutionChain,
    PokeApiListing,
    PokeApiPokemon,
    PokeApiSpecies,
    PokeApiType,
)
from app.sync.types import PokemonFetchResult, SpeciesFetchResult, TypeFetchResult

logger = logging.getLogger(__name__)


class PokeApiClient:
    """Reads everything the sync needs from PokéAPI: every Pokémon, every species, the evolution
    chains that link species into families, and how much damage each type does to the others.

    Pokémon and species are listed page by page; types are the ones the app knows. Each fetch
    then fetches every entry's details concurrently, at most `concurrency` requests at a time.
    A request that hits rate limiting, a server error or a network failure is tried up to
    `attempts` times in all, waiting `retry_delay` seconds before the first retry and twice as
    long before each one after. A 429 or 503 that says in Retry-After to wait a number of seconds
    is waited that long instead, up to MAX_RETRY_AFTER_SECONDS.

    One entry that keeps failing doesn't fail the fetch: its URL is reported in the result's
    `failed`, and the caller decides what that means. A listing that can't be trusted (it
    loops, never ends or points anywhere but PokéAPI) raises instead, because callers treat
    whatever is missing from a listing as removed. The client only ever requests URLs on
    PokéAPI itself, and it knows nothing about the database.
    """

    def __init__(
        self,
        http: httpx2.AsyncClient,
        *,
        concurrency: int = CONCURRENT_REQUESTS,
        attempts: int = MAX_ATTEMPTS,
        retry_delay: float = RETRY_DELAY_SECONDS,
    ) -> None:
        self._http = http
        self._limiter = anyio.CapacityLimiter(concurrency)
        self._attempts = attempts
        self._retry_delay = retry_delay

    async def fetch_pokemon(self) -> PokemonFetchResult:
        """Every Pokémon in PokéAPI's listing."""
        entries = await self._list_entries("pokemon")
        pokemon, failed = await self._fetch_details([e.url for e in entries], PokeApiPokemon)
        return PokemonFetchResult(pokemon, listed_ids={e.id for e in entries}, failed=failed)

    async def fetch_species(self) -> SpeciesFetchResult:
        """Every species in PokéAPI's listing, and the evolution chains they belong to."""
        entries = await self._list_entries("pokemon-species")
        species, failed_species = await self._fetch_details(
            [e.url for e in entries], PokeApiSpecies
        )
        # Every species in a family links to the same chain, so each chain is fetched once.
        chain_urls = dict.fromkeys(
            self._require_pokeapi_url(each.evolution_chain.url) for each in species
        )
        chains, failed_chains = await self._fetch_details(chain_urls, PokeApiEvolutionChain)
        return SpeciesFetchResult(species, chains, failed=failed_species + failed_chains)

    async def fetch_types(self) -> TypeFetchResult:
        """Every type a Pokémon can have, each with how much damage its moves do to the others."""
        urls = [f"{self._http.base_url}type/{type_}/" for type_ in PokemonType]
        types, failed = await self._fetch_details(urls, PokeApiType)
        return TypeFetchResult(types, failed=failed)

    async def _list_entries(self, resource: str) -> list[NamedApiResource]:
        """Every entry in a resource's listing, e.g. "pokemon", read page by page. Raises rather
        than return a partial or untrusted list.

        Callers treat Pokémon missing from the listing as removed, so a listing that points
        outside PokéAPI, loops or never ends must fail the sync instead of being trusted.
        """
        # Keyed by URL, which keeps listing order and drops repeats (offset paging can repeat
        # an entry if PokéAPI changes while we read it).
        entries: dict[str, NamedApiResource] = {}
        seen_pages: set[str] = set()
        page_url = resource
        params: dict[str, int] | None = {"limit": PAGE_SIZE}
        for _ in range(MAX_PAGES):
            page = PokeApiListing.model_validate(await self._get_json(page_url, params=params))
            entries.update((self._require_pokeapi_url(e.url), e) for e in page.results)
            if page.next is None:
                return list(entries.values())
            if page.next in seen_pages:
                raise PokeApiError(f"PokéAPI's listing loops back to {page.next}")
            seen_pages.add(page.next)
            # `next` is a full URL that already carries the offset and limit.
            page_url, params = self._require_pokeapi_url(page.next), None
        raise PokeApiError(f"PokéAPI's listing ran past {MAX_PAGES} pages")

    async def _fetch_details[T: BaseModel](
        self, urls: Iterable[str], shape: type[T]
    ) -> tuple[list[T], list[str]]:
        """Fetch every URL concurrently (within the limit) as a `shape`. Returns what was
        fetched, and the URLs that still failed after retrying.
        """
        fetched: list[T] = []
        failed: list[str] = []

        async def fetch(url: str) -> None:
            async with self._limiter:
                try:
                    fetched.append(shape.model_validate(await self._get_json(url)))
                # ValueError covers malformed JSON and failed validation.
                except (httpx2.HTTPError, ValueError) as error:
                    logger.warning("Giving up on %s: %s", url, error)
                    failed.append(url)

        async with anyio.create_task_group() as tasks:
            for url in urls:
                tasks.start_soon(fetch, url)
        return fetched, failed

    def _require_pokeapi_url(self, url: str) -> str:
        """Reject URLs from PokéAPI's responses that point anywhere but PokéAPI itself."""
        base, target = self._http.base_url, httpx2.URL(url)
        same_origin = (target.scheme, target.host, target.port) == (
            base.scheme,
            base.host,
            base.port,
        )
        if not same_origin or not target.path.startswith(base.path):
            raise PokeApiError(f"refusing to request a URL outside PokéAPI: {url}")
        return url

    async def _get_json(self, url: str, params: dict[str, int] | None = None) -> object:
        """GET a URL's JSON, retrying the failures worth retrying (see the class docstring)."""
        attempt = 1
        while True:
            try:
                response = await self._http.get(url, params=params)
                response.raise_for_status()
                return response.json()
            except httpx2.HTTPError as error:
                if not _is_retryable(error) or attempt >= self._attempts:
                    raise
                retry_after = _retry_after_seconds(error)
            await anyio.sleep(
                self._retry_delay * 2 ** (attempt - 1) if retry_after is None else retry_after
            )
            attempt += 1


def _is_retryable(error: httpx2.HTTPError) -> bool:
    if isinstance(error, httpx2.HTTPStatusError):
        return error.response.status_code in RETRYABLE_STATUS_CODES
    return isinstance(error, httpx2.TransportError)


def _retry_after_seconds(error: httpx2.HTTPError) -> int | None:
    """How many seconds a 429 or 503 asks to wait in its Retry-After, at most
    MAX_RETRY_AFTER_SECONDS. None for any other error, and for a Retry-After that isn't a whole
    number of seconds, such as a date, or that has more than MAX_RETRY_AFTER_DIGITS digits.
    """
    if (
        not isinstance(error, httpx2.HTTPStatusError)
        or error.response.status_code not in RETRY_AFTER_STATUS_CODES
    ):
        return None
    seconds = error.response.headers.get("Retry-After", "")
    if not (seconds.isascii() and seconds.isdecimal() and len(seconds) <= MAX_RETRY_AFTER_DIGITS):
        return None
    return min(int(seconds), MAX_RETRY_AFTER_SECONDS)
