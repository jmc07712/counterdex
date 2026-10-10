from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.sync.enums import SyncStatus
from app.sync.queries import get_sync_overview
from tests.support.sync import add_sync_run

MORNING = datetime(2026, 10, 10, 9, tzinfo=UTC)
NEXT_MORNING = MORNING + timedelta(days=1)


def test_reports_nothing_before_the_first_sync(db_session: Session) -> None:
    overview = get_sync_overview(db_session)

    assert (overview.last_synced_at, overview.latest_run) == (None, None)


def test_reports_the_latest_sync(db_session: Session) -> None:
    add_sync_run(db_session, finished_at=MORNING)
    add_sync_run(db_session, finished_at=NEXT_MORNING)

    overview = get_sync_overview(db_session)

    assert overview.last_synced_at == NEXT_MORNING
    assert overview.latest_run is not None
    assert overview.latest_run.finished_at == NEXT_MORNING


def test_a_failed_sync_does_not_hide_when_the_data_was_last_fresh(db_session: Session) -> None:
    add_sync_run(db_session, finished_at=MORNING)
    add_sync_run(db_session, finished_at=NEXT_MORNING, status=SyncStatus.FAILED)

    overview = get_sync_overview(db_session)

    assert overview.last_synced_at == MORNING
    assert overview.latest_run is not None
    assert overview.latest_run.status is SyncStatus.FAILED
