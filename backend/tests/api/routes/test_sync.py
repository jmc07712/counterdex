from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api.constants import SYNC_STATUS_CACHE_CONTROL
from tests.support.sync import add_sync_run


def test_reports_when_the_pokedex_was_last_synced(client: TestClient, db_session: Session) -> None:
    add_sync_run(db_session)

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
            "removed": 3,
            "restored": 4,
            "failed": 1,
        },
    }


def test_is_briefly_cacheable(client: TestClient) -> None:
    cache_control = client.get("/api/sync/status").headers["cache-control"]

    assert cache_control == SYNC_STATUS_CACHE_CONTROL
