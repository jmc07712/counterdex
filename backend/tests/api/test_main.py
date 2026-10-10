import pytest
from fastapi.testclient import TestClient


def test_openapi_schema_is_served_under_api_prefix(client: TestClient) -> None:
    # Vercel routes only /api/* to this service, so docs must live there too.
    response = client.get("/api/openapi.json")

    assert response.status_code == 200
    assert response.json()["info"]["title"] == "Counterdex API"


def test_interactive_docs_are_served_under_api_prefix(client: TestClient) -> None:
    assert client.get("/api/docs").status_code == 200


@pytest.mark.parametrize("path", ["/", "/docs", "/openapi.json"])
def test_paths_outside_api_are_left_to_the_frontend(client: TestClient, path: str) -> None:
    # Anything outside /api belongs to the frontend, so FastAPI must not claim these paths.
    assert client.get(path).status_code == 404
