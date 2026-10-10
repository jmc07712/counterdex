from collections.abc import Callable

import pytest
from sqlalchemy import Connection, func, select
from sqlalchemy.orm import Session

from app.jobs.sync_pokemon import sync_pokemon
from app.pokemon.models import Pokemon
from app.sync.enums import SyncStatus
from app.sync.models import SyncRun
from tests.support.pokeapi import fake_pokeapi

pytestmark = pytest.mark.anyio


@pytest.fixture
def sessions(connection: Connection) -> Callable[[], Session]:
    """Sessions whose commits stay inside the test's transaction, which is rolled back."""
    return lambda: Session(bind=connection, join_transaction_mode="create_savepoint")


def counts(sessions: Callable[[], Session]) -> tuple[int, list[SyncStatus]]:
    with sessions() as session:
        pokemon = session.scalar(select(func.count()).select_from(Pokemon)) or 0
        statuses = list(session.scalars(select(SyncRun.status)))
    return pokemon, statuses


async def test_saves_a_successful_sync_and_exits_zero(sessions: Callable[[], Session]) -> None:
    exit_code = await sync_pokemon(fake_pokeapi(), sessions)

    assert exit_code == 0
    assert counts(sessions) == (2, [SyncStatus.SUCCEEDED])


async def test_exits_non_zero_when_some_pokemon_failed(sessions: Callable[[], Session]) -> None:
    exit_code = await sync_pokemon(fake_pokeapi(failing=("pokemon/6",)), sessions)

    assert exit_code == 1
    # What did sync is still saved; the failure is on the run record.
    assert counts(sessions) == (1, [SyncStatus.SUCCEEDED])


async def test_keeps_nothing_and_records_the_failure_when_the_sync_fails(
    sessions: Callable[[], Session],
) -> None:
    exit_code = await sync_pokemon(fake_pokeapi(failing=("pokemon",)), sessions)

    assert exit_code == 1
    assert counts(sessions) == (0, [SyncStatus.FAILED])
