import pytest
from fastapi.testclient import TestClient

from app.api.constants import SYNC_STATUS_CACHE_CONTROL


@pytest.mark.parametrize("path", ["/api/health", "/api/docs", "/api/openapi.json", "/api/session"])
def test_a_response_that_sets_no_policy_is_never_cached(ash_client: TestClient, path: str) -> None:
    # Signed in, so the session route answers with who that is.
    response = ash_client.get(path)

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"


def test_a_response_that_sets_a_policy_keeps_it(client: TestClient) -> None:
    assert client.get("/api/sync/status").headers["cache-control"] == SYNC_STATUS_CACHE_CONTROL


@pytest.mark.parametrize(
    ("method", "path", "headers", "status_code"),
    [
        pytest.param(
            "GET", "/api/teams/00000000-0000-4000-8000-000000000001", {}, 404, id="not-found"
        ),
        pytest.param("GET", "/api/session", {}, 401, id="not-signed-in"),
        pytest.param(
            "DELETE", "/api/session", {"sec-fetch-site": "cross-site"}, 403, id="cross-origin"
        ),
    ],
)
def test_errors_are_never_cached(
    client: TestClient, method: str, path: str, headers: dict[str, str], status_code: int
) -> None:
    response = client.request(method, path, headers=headers)

    assert response.status_code == status_code
    assert response.headers["cache-control"] == "no-store"
