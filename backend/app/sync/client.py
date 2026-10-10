"""HTTP client for PokéAPI. Knows nothing about our database."""

import logging

import anyio
import httpx2

from app.sync.constants import (
    CONCURRENT_REQUESTS,
    MAX_ATTEMPTS,
    MAX_PAGES,
    PAGE_SIZE,
    RETRY_DELAY_SECONDS,
    RETRYABLE_STATUS_CODES,
)
from app.sync.exceptions import PokeApiError
from app.sync.schemas import PokeApiListing, PokeApiPokemon
from app.sync.types import FetchResult

logger = logging.getLogger(__name__)


class PokeApiClient:
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

    async def fetch_all(self) -> FetchResult:
        """List every Pokémon, then fetch their details concurrently (within the limit)."""
        urls = await self._list_pokemon_urls()
        result = FetchResult(listed_ids={_pokemon_id(url) for url in urls})
        async with anyio.create_task_group() as tasks:
            for url in urls:
                tasks.start_soon(self._fetch_into, url, result)
        return result

    async def _list_pokemon_urls(self) -> list[str]:
        """Every Pokémon URL in the listing, or an error; never a partial or untrusted list.

        Callers treat Pokémon missing from the listing as removed, so a listing that points
        outside PokéAPI, loops or never ends must fail the sync instead of being trusted.
        """
        # A dict keeps listing order and drops repeats (offset paging can repeat an entry
        # if PokéAPI changes while we read it).
        urls: dict[str, None] = {}
        seen_pages: set[str] = set()
        page_url = "pokemon"
        params: dict[str, int] | None = {"limit": PAGE_SIZE}
        for _ in range(MAX_PAGES):
            page = PokeApiListing.model_validate(await self._get_json(page_url, params=params))
            urls.update(dict.fromkeys(self._require_pokeapi_url(e.url) for e in page.results))
            if page.next is None:
                return list(urls)
            if page.next in seen_pages:
                raise PokeApiError(f"PokéAPI's listing loops back to {page.next}")
            seen_pages.add(page.next)
            # `next` is a full URL that already carries the offset and limit.
            page_url, params = self._require_pokeapi_url(page.next), None
        raise PokeApiError(f"PokéAPI's listing ran past {MAX_PAGES} pages")

    async def _fetch_into(self, url: str, result: FetchResult) -> None:
        async with self._limiter:
            try:
                result.pokemon.append(PokeApiPokemon.model_validate(await self._get_json(url)))
            # ValueError covers malformed JSON and failed validation.
            except (httpx2.HTTPError, ValueError) as error:
                logger.warning("Giving up on %s: %s", url, error)
                result.failed.append(url)

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
        attempt = 1
        while True:
            try:
                response = await self._http.get(url, params=params)
                response.raise_for_status()
                return response.json()
            except httpx2.HTTPError as error:
                if not _is_retryable(error) or attempt >= self._attempts:
                    raise
            await anyio.sleep(self._retry_delay * 2 ** (attempt - 1))
            attempt += 1


def _pokemon_id(url: str) -> int:
    """The id at the end of a listing URL, e.g. https://pokeapi.co/api/v2/pokemon/25/ -> 25."""
    last_segment = httpx2.URL(url).path.rstrip("/").rsplit("/", 1)[-1]
    if not last_segment.isdigit():
        raise PokeApiError(f"listing entry has no Pokémon id: {url}")
    return int(last_segment)


def _is_retryable(error: httpx2.HTTPError) -> bool:
    if isinstance(error, httpx2.HTTPStatusError):
        return error.response.status_code in RETRYABLE_STATUS_CODES
    return isinstance(error, httpx2.TransportError)
