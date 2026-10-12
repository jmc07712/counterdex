import json
import re

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def docs_page(client: TestClient) -> str:
    """The interactive docs page's HTML."""
    return client.get("/api/docs").text


@pytest.mark.parametrize("path", ["/api", "/api/"])
def test_the_api_root_redirects_to_the_docs(client: TestClient, path: str) -> None:
    response = client.get(path, follow_redirects=False)

    assert response.status_code == 307
    # Relative, so the browser stays on the public host rather than the server's own address.
    assert response.headers["location"] == "/api/docs"


def test_the_docs_page_renders_this_apis_schema(docs_page: str) -> None:
    assert "/api/openapi.json" in docs_page


def test_the_docs_page_loads_a_pinned_scalar_release(docs_page: str) -> None:
    # The page runs Scalar's script, so a new release mustn't change the page unseen.
    assert re.search(
        r"https://cdn\.jsdelivr\.net/npm/@scalar/api-reference@\d+\.\d+\.\d+", docs_page
    )


def test_the_docs_page_does_not_report_back_to_scalar(docs_page: str) -> None:
    scalar_config = re.search(r"createApiReference\([^,]+, (\{.*\})\)", docs_page)

    assert scalar_config is not None
    config = json.loads(scalar_config.group(1))
    assert (config["telemetry"], config["agent"]) == (False, {"disabled": True})
