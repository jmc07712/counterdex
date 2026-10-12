from typing import Any

import pytest
from fastapi.testclient import TestClient


def operations(openapi: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Each operation in the schema, by method and path, e.g. "GET /api/pokemon"."""
    return {
        f"{method.upper()} {path}": operation
        for path, methods in openapi["paths"].items()
        for method, operation in methods.items()
    }


@pytest.mark.parametrize("path", ["/", "/docs", "/openapi.json"])
def test_paths_outside_api_are_left_to_the_frontend(client: TestClient, path: str) -> None:
    # Anything outside /api belongs to the frontend, so FastAPI must not claim these paths.
    assert client.get(path).status_code == 404


SIGNED_IN_ROUTES = {
    "GET /api/session",
    "GET /api/sync/runs",
    "PUT /api/teams/{team_id}",
    "PATCH /api/teams/{team_id}",
    "DELETE /api/teams/{team_id}",
    "POST /api/teams/{team_id}/members",
    "PUT /api/teams/{team_id}/members/{pokemon_id}",
    "DELETE /api/teams/{team_id}/members/{pokemon_id}",
    "PUT /api/teams/{team_id}/order",
}


def test_the_docs_mark_the_routes_that_need_signing_in(openapi: dict[str, Any]) -> None:
    marked = {
        name
        for name, operation in operations(openapi).items()
        if operation.get("security") == [{"SessionCookie": []}]
    }

    assert marked == SIGNED_IN_ROUTES
    scheme = openapi["components"]["securitySchemes"]["SessionCookie"]
    assert (scheme["type"], scheme["in"], scheme["name"]) == ("apiKey", "cookie", "__Host-session")


def test_the_docs_sort_every_route_under_one_tag_in_a_group(openapi: dict[str, Any]) -> None:
    grouped = {tag for group in openapi["x-tagGroups"] for tag in group["tags"]}

    assert all(
        len(operation["tags"]) == 1 and operation["tags"][0] in grouped
        for operation in operations(openapi).values()
    )


def test_the_docs_describe_every_route_and_parameter(openapi: dict[str, Any]) -> None:
    undescribed_routes = {
        name for name, operation in operations(openapi).items() if not operation.get("description")
    }
    undescribed_parameters = {
        f"{name} {parameter['name']}"
        for name, operation in operations(openapi).items()
        for parameter in operation.get("parameters", [])
        if not parameter.get("description")
    }

    # The health check is for uptime monitors; its summary says enough.
    assert undescribed_routes == {"GET /api/health"}
    assert undescribed_parameters == set()
