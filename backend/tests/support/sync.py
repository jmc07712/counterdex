from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.sync.enums import SyncStatus
from app.sync.models import SyncRun


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
