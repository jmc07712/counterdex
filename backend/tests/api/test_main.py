from typing import Any

import pytest
from fastapi.testclient import TestClient


def test_openapi_schema_is_served_under_api_prefix(openapi: dict[str, Any]) -> None:
    # Vercel routes only /api/* to this service, so docs must live there too (see test_docs.py
    # for the docs page itself).
    assert openapi["info"]["title"] == "Counterdex API"


@pytest.mark.parametrize("path", ["/", "/docs", "/openapi.json"])
def test_paths_outside_api_are_left_to_the_frontend(client: TestClient, path: str) -> None:
    # Anything outside /api belongs to the frontend, so FastAPI must not claim these paths.
    assert client.get(path).status_code == 404


def test_operations_are_named_after_their_routes(openapi: dict[str, Any]) -> None:
    # Generated clients name their functions after these, e.g. listPokemon().
    paths = openapi["paths"]

    assert paths["/api/pokemon"]["get"]["operationId"] == "list_pokemon"
    assert paths["/api/health"]["get"]["operationId"] == "health"


SIGNED_IN_ROUTES = {
    "GET /api/session",
    "GET /api/teams",
    "PUT /api/teams/{team_id}",
    "GET /api/teams/{team_id}",
    "PATCH /api/teams/{team_id}",
    "DELETE /api/teams/{team_id}",
    "POST /api/teams/{team_id}/members",
    "PUT /api/teams/{team_id}/members/{pokemon_id}",
    "DELETE /api/teams/{team_id}/members/{pokemon_id}",
    "PUT /api/teams/{team_id}/order",
}


def test_the_docs_mark_the_routes_that_need_signing_in(openapi: dict[str, Any]) -> None:
    marked = {
        f"{method.upper()} {path}"
        for path, operations in openapi["paths"].items()
        for method, operation in operations.items()
        if operation.get("security") == [{"SessionCookie": []}]
    }

    assert marked == SIGNED_IN_ROUTES
    scheme = openapi["components"]["securitySchemes"]["SessionCookie"]
    assert (scheme["type"], scheme["in"], scheme["name"]) == ("apiKey", "cookie", "__Host-session")
