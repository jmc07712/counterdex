from datetime import UTC, datetime, timedelta
from typing import Any

import httpx2
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.accounts.models import User
from app.accounts.types import SignedIn
from app.api.constants import SYNC_STATUS_CACHE_CONTROL
from app.sync.enums import SyncStatus
from tests.support.sync import add_sync_run

MORNING = datetime(2026, 10, 10, 9, tzinfo=UTC)
DAY = timedelta(days=1)


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


# --- GET /api/sync/runs ---


def run_ids(response: httpx2.Response) -> list[int]:
    return [run["id"] for run in response.json()["items"]]


def test_lists_the_runs_newest_first(oak_client: TestClient, db_session: Session) -> None:
    oldest = add_sync_run(db_session, started_at=MORNING)
    newest = add_sync_run(db_session, started_at=MORNING + 2 * DAY)
    middle = add_sync_run(db_session, started_at=MORNING + DAY)

    response = oak_client.get("/api/sync/runs")

    assert response.status_code == 200
    assert run_ids(response) == [newest.id, middle.id, oldest.id]


def test_puts_the_run_recorded_last_first_among_runs_that_started_together(
    oak_client: TestClient, db_session: Session
) -> None:
    first = add_sync_run(db_session, started_at=MORNING)
    second = add_sync_run(db_session, started_at=MORNING)

    assert run_ids(oak_client.get("/api/sync/runs")) == [second.id, first.id]


def test_shows_each_runs_counts(oak_client: TestClient, db_session: Session) -> None:
    run = add_sync_run(
        db_session,
        failed=["https://pokeapi.co/api/v2/pokemon/6/", "https://pokeapi.co/api/v2/pokemon/9/"],
    )

    page = oak_client.get("/api/sync/runs").json()

    assert page["items"] == [
        {
            "id": run.id,
            "started_at": "2026-10-10T08:59:57Z",
            "finished_at": "2026-10-10T09:00:00Z",
            "status": "succeeded",
            "fetched": 1351,
            "inserted": 1,
            "updated": 2,
            "unchanged": 1344,
            "removed": 3,
            "restored": 4,
            "failed_count": 2,
            "error": None,
        }
    ]


def test_says_why_a_run_failed(oak_client: TestClient, db_session: Session) -> None:
    add_sync_run(
        db_session,
        status=SyncStatus.FAILED,
        failed=[],
        error="PokeApiError: PokéAPI sent something we can't trust.",
    )

    (run,) = oak_client.get("/api/sync/runs").json()["items"]

    assert run["status"] == "failed"
    assert run["error"] == "PokeApiError: PokéAPI sent something we can't trust."
    assert run["failed_count"] == 0


def test_pages_through_the_runs(oak_client: TestClient, db_session: Session) -> None:
    runs = [add_sync_run(db_session, started_at=MORNING + n * DAY) for n in range(5)]
    newest_first = [run.id for run in reversed(runs)]

    pages = [
        oak_client.get("/api/sync/runs", params={"page": page, "page_size": 2}).json()
        for page in (1, 2, 3)
    ]

    assert [[run["id"] for run in page["items"]] for page in pages] == [
        newest_first[:2],
        newest_first[2:4],
        newest_first[4:],
    ]
    assert [
        (page["page"], page["page_size"], page["total"], page["total_pages"]) for page in pages
    ] == [
        (1, 2, 5, 3),
        (2, 2, 5, 3),
        (3, 2, 5, 3),
    ]


def test_a_page_holds_20_runs_unless_asked_for_another_size(
    oak_client: TestClient, db_session: Session
) -> None:
    for n in range(21):
        add_sync_run(db_session, started_at=MORNING + n * DAY)

    page = oak_client.get("/api/sync/runs").json()

    assert len(page["items"]) == 20
    assert (page["page"], page["page_size"], page["total"], page["total_pages"]) == (1, 20, 21, 2)


@pytest.mark.parametrize(
    ("runs", "total_pages"),
    [
        pytest.param(0, 1, id="none"),
        pytest.param(1, 1, id="one"),
        pytest.param(2, 1, id="exactly-one-page"),
        pytest.param(3, 2, id="one-more-than-a-page"),
        pytest.param(4, 2, id="exactly-two-pages"),
        pytest.param(5, 3, id="one-more-than-two-pages"),
    ],
)
def test_counts_the_pages(
    oak_client: TestClient, db_session: Session, runs: int, total_pages: int
) -> None:
    for n in range(runs):
        add_sync_run(db_session, started_at=MORNING + n * DAY)

    page = oak_client.get("/api/sync/runs", params={"page_size": 2}).json()

    assert (page["total"], page["total_pages"]) == (runs, total_pages)


def test_an_empty_list_is_page_one_of_one(oak_client: TestClient) -> None:
    response = oak_client.get("/api/sync/runs")

    assert response.status_code == 200
    assert response.json() == {
        "items": [],
        "page": 1,
        "page_size": 20,
        "total": 0,
        "total_pages": 1,
    }


def test_a_page_past_the_end_is_empty_not_an_error(
    oak_client: TestClient, db_session: Session
) -> None:
    for n in range(3):
        add_sync_run(db_session, started_at=MORNING + n * DAY)

    response = oak_client.get("/api/sync/runs", params={"page": 9, "page_size": 2})

    assert response.status_code == 200
    assert response.json() == {"items": [], "page": 9, "page_size": 2, "total": 3, "total_pages": 2}


@pytest.mark.parametrize(
    "params",
    [
        pytest.param({"page": 1, "page_size": 1}, id="smallest"),
        pytest.param({"page": 2**31 - 1, "page_size": 100}, id="largest"),
    ],
)
def test_accepts_the_smallest_and_largest_pages(
    oak_client: TestClient, params: dict[str, int]
) -> None:
    assert oak_client.get("/api/sync/runs", params=params).status_code == 200


@pytest.mark.parametrize(
    "params",
    [
        pytest.param({"page": 0}, id="page-zero"),
        pytest.param({"page": -1}, id="negative-page"),
        pytest.param({"page": 2**31}, id="page-too-large-for-the-database"),
        pytest.param({"page": "first"}, id="page-not-a-number"),
        pytest.param({"page_size": 0}, id="page-size-zero"),
        pytest.param({"page_size": 101}, id="page-size-over-100"),
        pytest.param({"page_size": "all"}, id="page-size-not-a-number"),
    ],
)
def test_rejects_pages_that_cannot_exist(oak_client: TestClient, params: dict[str, Any]) -> None:
    assert oak_client.get("/api/sync/runs", params=params).status_code == 422


def test_turns_away_who_is_not_signed_in(client: TestClient, db_session: Session) -> None:
    add_sync_run(db_session)

    response = client.get("/api/sync/runs")

    assert response.status_code == 401
    assert response.json().keys() == {"detail"}


def test_turns_away_who_is_not_an_admin(ash_client: TestClient, db_session: Session) -> None:
    add_sync_run(db_session)

    response = ash_client.get("/api/sync/runs")

    assert response.status_code == 403
    assert response.json() == {"detail": "Only admins can see this."}


def test_taking_admin_away_works_at_once(
    oak_client: TestClient, db_session: Session, oak: SignedIn
) -> None:
    assert oak_client.get("/api/sync/runs").status_code == 200

    db_session.execute(update(User).where(User.id == oak.user.id).values(is_admin=False))

    assert oak_client.get("/api/sync/runs").status_code == 403


def test_the_runs_are_never_cached(oak_client: TestClient) -> None:
    assert oak_client.get("/api/sync/runs").headers["cache-control"] == "no-store"


def test_documents_the_route_as_one_for_admins(openapi: dict[str, Any]) -> None:
    operation = openapi["paths"]["/api/sync/runs"]["get"]
    described = {param["name"] for param in operation["parameters"] if param.get("description")}

    assert operation["security"] == [{"SessionCookie": []}]
    assert operation["tags"] == ["Sync"]
    assert "admins" in operation["summary"]
    assert "admins" in operation["description"]
    assert {"200", "401", "403", "422"} <= operation["responses"].keys()
    assert described == {"page", "page_size"}
