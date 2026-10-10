from datetime import UTC, datetime
from pathlib import Path

import httpx2
import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Pokemon
from app.sync.pokeapi import PokeApiClient
from app.sync.run import SyncReport, run_sync

pytestmark = pytest.mark.anyio

BASE_URL = "https://pokeapi.test/api/v2/"
FIXTURES = Path(__file__).parent / "fixtures" / "pokeapi"
NOW = datetime(2026, 10, 10, 9, tzinfo=UTC)


def fake_pokeapi(
    *, broken_id: int | None = None, extra_urls: tuple[str, ...] = ()
) -> PokeApiClient:
    async def handler(request: httpx2.Request) -> httpx2.Response:
        if request.url.path.endswith("/pokemon"):
            urls = [f"{BASE_URL}pokemon/{pokemon_id}/" for pokemon_id in (6, 25)]
            urls += extra_urls
            return httpx2.Response(
                200, json={"next": None, "results": [{"name": u, "url": u} for u in urls]}
            )
        pokemon_id = int(request.url.path.rstrip("/").rsplit("/", 1)[1])
        if pokemon_id == broken_id:
            return httpx2.Response(500)
        return httpx2.Response(200, text=(FIXTURES / f"pokemon-{pokemon_id}.json").read_text())

    http = httpx2.AsyncClient(base_url=BASE_URL, transport=httpx2.MockTransport(handler))
    return PokeApiClient(http, retry_delay=0)


async def test_syncs_pokeapi_into_the_database(db_session: Session) -> None:
    report = await run_sync(fake_pokeapi(), db_session, now=NOW)

    assert report == SyncReport(fetched=2, inserted=2, updated=0, unchanged=0, failed=[])
    assert db_session.scalar(select(func.count()).select_from(Pokemon)) == 2


async def test_a_second_sync_with_no_upstream_changes_writes_nothing(db_session: Session) -> None:
    await run_sync(fake_pokeapi(), db_session, now=NOW)

    report = await run_sync(fake_pokeapi(), db_session, now=NOW)

    assert (report.inserted, report.updated, report.unchanged) == (0, 0, 2)


async def test_reports_failures_and_still_stores_the_rest(db_session: Session) -> None:
    report = await run_sync(fake_pokeapi(broken_id=6), db_session, now=NOW)

    assert report.failed == [f"{BASE_URL}pokemon/6/"]
    assert report.inserted == 1


async def test_leaves_committing_to_the_caller(db_session: Session) -> None:
    # Callers combine the sync with other writes (change events, run records) in one
    # transaction, so run_sync must not commit on its own.
    await run_sync(fake_pokeapi(), db_session, now=NOW)

    db_session.rollback()

    assert db_session.scalar(select(func.count()).select_from(Pokemon)) == 0


async def test_stores_a_pokemon_once_even_if_two_listing_urls_resolve_to_it(
    db_session: Session,
) -> None:
    # A second spelling of Pikachu's URL is a different listing entry with the same id.
    report = await run_sync(
        fake_pokeapi(extra_urls=(f"{BASE_URL}pokemon/25",)), db_session, now=NOW
    )

    assert report.inserted == 2
    assert db_session.scalar(select(func.count()).select_from(Pokemon)) == 2
