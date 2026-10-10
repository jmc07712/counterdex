from datetime import UTC, datetime

import pytest
from sqlalchemy import Engine, func, select, text
from sqlalchemy.orm import Session

from app.pokemon.models import Pokemon
from app.sync.constants import SYNC_LOCK_KEY
from app.sync.exceptions import SyncAlreadyRunningError
from app.sync.models import PokemonChange, SyncRun
from app.sync.service import record_failed_sync, run_sync
from tests.support.pokeapi import BASE_URL, fake_pokeapi

pytestmark = pytest.mark.anyio

NOW = datetime(2026, 10, 10, 9, tzinfo=UTC)


def clock() -> datetime:
    return NOW


def count(session: Session, model: type[Pokemon | SyncRun | PokemonChange]) -> int:
    return session.scalar(select(func.count()).select_from(model)) or 0


async def test_syncs_pokeapi_into_the_database(db_session: Session) -> None:
    report = await run_sync(fake_pokeapi(), db_session, clock=clock)

    assert (report.fetched, report.inserted, report.failed) == (2, 2, [])
    assert count(db_session, Pokemon) == 2


async def test_records_a_sync_run(db_session: Session) -> None:
    report = await run_sync(fake_pokeapi(broken_id=6), db_session, clock=clock)

    run = db_session.get(SyncRun, report.run_id)
    assert run is not None
    assert (run.status, run.inserted, run.failed) == ("succeeded", 1, [f"{BASE_URL}pokemon/6/"])
    assert (run.started_at, run.finished_at) == (NOW, NOW)


async def test_records_each_change_against_its_sync_run(db_session: Session) -> None:
    await run_sync(fake_pokeapi(), db_session, clock=clock)

    report = await run_sync(fake_pokeapi(speeds={25: 150}), db_session, clock=clock)

    change = db_session.scalars(select(PokemonChange)).one()
    assert (change.pokemon_id, change.kind, change.sync_run_id) == (25, "updated", report.run_id)
    assert change.before is not None
    assert change.after is not None
    assert (change.before["speed"], change.after["speed"]) == (90, 150)
    assert change.detected_at == NOW


async def test_a_second_sync_with_no_upstream_changes_records_no_changes(
    db_session: Session,
) -> None:
    await run_sync(fake_pokeapi(), db_session, clock=clock)

    report = await run_sync(fake_pokeapi(), db_session, clock=clock)

    assert (report.inserted, report.updated, report.unchanged) == (0, 0, 2)
    assert count(db_session, PokemonChange) == 0


async def test_leaves_committing_to_the_caller(db_session: Session) -> None:
    # Callers save the sync together with any related writes, so run_sync never commits.
    await run_sync(fake_pokeapi(), db_session, clock=clock)

    db_session.rollback()

    assert (count(db_session, Pokemon), count(db_session, SyncRun)) == (0, 0)


async def test_refuses_to_run_alongside_another_sync(
    db_session: Session, migrated_engine: Engine
) -> None:
    with migrated_engine.connect() as other:
        other.execute(text("select pg_advisory_lock(:key)"), {"key": SYNC_LOCK_KEY})
        try:
            with pytest.raises(SyncAlreadyRunningError):
                await run_sync(fake_pokeapi(), db_session, clock=clock)
        finally:
            other.execute(text("select pg_advisory_unlock(:key)"), {"key": SYNC_LOCK_KEY})


async def test_stores_a_pokemon_once_even_if_two_listing_urls_resolve_to_it(
    db_session: Session,
) -> None:
    # A second spelling of Pikachu's URL is a different listing entry with the same id.
    report = await run_sync(
        fake_pokeapi(extra_urls=(f"{BASE_URL}pokemon/25",)), db_session, clock=clock
    )

    assert report.inserted == 2
    assert count(db_session, Pokemon) == 2


def test_records_a_failed_sync(db_session: Session) -> None:
    run = record_failed_sync(db_session, started_at=NOW, error="PokéAPI is down", clock=clock)

    assert db_session.get(SyncRun, run.id) is run
    assert (run.status, run.error, run.fetched, run.failed) == ("failed", "PokéAPI is down", 0, [])
