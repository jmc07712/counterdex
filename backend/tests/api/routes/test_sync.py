from datetime import UTC, datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.sync.enums import SyncStatus
from app.sync.models import SyncRun


def test_reports_when_the_pokedex_was_last_synced(client: TestClient, db_session: Session) -> None:
    db_session.add(
        SyncRun(
            started_at=datetime(2026, 10, 10, 8, 59, 57, tzinfo=UTC),
            finished_at=datetime(2026, 10, 10, 9, tzinfo=UTC),
            status=SyncStatus.SUCCEEDED,
            fetched=1351,
            inserted=1,
            updated=2,
            unchanged=1348,
            removed=0,
            restored=0,
            failed=[],
        )
    )
    db_session.flush()

    response = client.get("/api/sync/status")

    assert response.status_code == 200
    assert response.json() == {
        "last_synced_at": "2026-10-10T09:00:00Z",
        "latest_run": {
            "status": "succeeded",
            "started_at": "2026-10-10T08:59:57Z",
            "finished_at": "2026-10-10T09:00:00Z",
            "inserted": 1,
            "updated": 2,
            "removed": 0,
            "restored": 0,
            "failed": 0,
        },
    }


def test_is_briefly_cacheable(client: TestClient) -> None:
    cache_control = client.get("/api/sync/status").headers["cache-control"]

    assert cache_control == "public, max-age=60, s-maxage=300, stale-while-revalidate=3600"
