from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.sync.enums import SyncStatus
from app.sync.models import SyncRun
from app.sync.queries import get_sync_overview

MORNING = datetime(2026, 10, 10, 9, tzinfo=UTC)


def add_run(session: Session, status: SyncStatus, finished_at: datetime) -> SyncRun:
    run = SyncRun(
        started_at=finished_at - timedelta(seconds=3),
        finished_at=finished_at,
        status=status,
        fetched=1351,
        inserted=0,
        updated=2,
        unchanged=1349,
        removed=0,
        restored=0,
        failed=["https://pokeapi.co/api/v2/pokemon/6/"],
    )
    session.add(run)
    session.flush()
    return run


def test_reports_nothing_before_the_first_sync(db_session: Session) -> None:
    overview = get_sync_overview(db_session)

    assert (overview.last_synced_at, overview.latest_run) == (None, None)


def test_reports_the_latest_sync(db_session: Session) -> None:
    add_run(db_session, SyncStatus.SUCCEEDED, MORNING)
    add_run(db_session, SyncStatus.SUCCEEDED, MORNING + timedelta(days=1))

    overview = get_sync_overview(db_session)

    assert overview.last_synced_at == MORNING + timedelta(days=1)
    assert overview.latest_run is not None
    assert (overview.latest_run.status, overview.latest_run.updated) == (SyncStatus.SUCCEEDED, 2)
    assert overview.latest_run.failed == 1


def test_a_failed_sync_does_not_hide_when_the_data_was_last_fresh(db_session: Session) -> None:
    add_run(db_session, SyncStatus.SUCCEEDED, MORNING)
    add_run(db_session, SyncStatus.FAILED, MORNING + timedelta(days=1))

    overview = get_sync_overview(db_session)

    assert overview.last_synced_at == MORNING
    assert overview.latest_run is not None
    assert overview.latest_run.status is SyncStatus.FAILED
