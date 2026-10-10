from typing import Any

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def openapi(client: TestClient) -> dict[str, Any]:
    """The OpenAPI schema the API serves."""
    schema: dict[str, Any] = client.get("/api/openapi.json").json()
    return schema
