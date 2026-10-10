from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.sync.enums import ChangeKind, SyncStatus
from app.sync.models import PokemonChange, SyncRun
from tests.support.pokemon import gyarados_columns


def make_sync_run(**overrides: Any) -> SyncRun:
    """A finished sync run; tests override only the fields they're about.

    Its counts all differ, so a swapped field can't go unnoticed.
    """
    fields: dict[str, Any] = {
        "started_at": datetime(2026, 10, 10, 8, 59, 57, tzinfo=UTC),
        "finished_at": datetime(2026, 10, 10, 9, tzinfo=UTC),
        "status": SyncStatus.SUCCEEDED,
        "fetched": 1351,
        "inserted": 1,
        "updated": 2,
        "unchanged": 1344,
        "removed": 3,
        "restored": 4,
        "failed": ["https://pokeapi.co/api/v2/pokemon/6/"],
    }
    return SyncRun(**(fields | overrides))


def add_sync_run(session: Session, **overrides: Any) -> SyncRun:
    """Saves a sync run. Runs are numbered in the order they're saved, so the last is the latest."""
    run = make_sync_run(**overrides)
    session.add(run)
    session.flush()
    return run


def gyarados_snapshot(**columns: Any) -> dict[str, Any]:
    """Gyarados as a change's snapshot stores it: its columns without the id, some changed."""
    snapshot = gyarados_columns() | columns
    del snapshot["id"]
    return snapshot


def add_change(
    session: Session,
    pokemon_id: int,
    kind: ChangeKind,
    *,
    before: dict[str, Any] | None,
    after: dict[str, Any] | None,
    detected_at: datetime,
) -> PokemonChange:
    """Saves a change to a Pokémon, found by a sync run of its own that finished at
    `detected_at`.
    """
    run = add_sync_run(session, finished_at=detected_at)
    change = PokemonChange(
        pokemon_id=pokemon_id,
        sync_run_id=run.id,
        detected_at=detected_at,
        kind=kind,
        before=before,
        after=after,
    )
    session.add(change)
    session.flush()
    return change
