import json
import re

import pytest
from fastapi.testclient import TestClient


@pytest.mark.parametrize("path", ["/api", "/api/"])
def test_the_api_root_redirects_to_the_docs(client: TestClient, path: str) -> None:
    response = client.get(path, follow_redirects=False)

    assert response.status_code == 307
    # Relative, so the browser stays on the public host rather than the server's own address.
    assert response.headers["location"] == "/api/docs"


def test_the_docs_routes_are_not_listed_as_endpoints(client: TestClient) -> None:
    paths = client.get("/api/openapi.json").json()["paths"]

    assert paths.keys().isdisjoint({"/api", "/api/", "/api/docs"})


def test_the_docs_page_renders_this_apis_schema(client: TestClient) -> None:
    page = client.get("/api/docs")

    assert page.status_code == 200
    assert "/api/openapi.json" in page.text


def test_the_docs_page_loads_a_pinned_scalar_release(client: TestClient) -> None:
    page = client.get("/api/docs")

    assert "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.1" in page.text


def test_the_docs_page_does_not_report_back_to_scalar(client: TestClient) -> None:
    page = client.get("/api/docs").text
    scalar_config = re.search(r"createApiReference\([^,]+, (\{.*\})\)", page)

    assert scalar_config is not None
    config = json.loads(scalar_config.group(1))
    assert (config["telemetry"], config["agent"]) == (False, {"disabled": True})
