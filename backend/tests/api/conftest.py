from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings


@pytest.fixture
def openapi(client: TestClient) -> dict[str, Any]:
    """The OpenAPI schema the API serves."""
    schema: dict[str, Any] = client.get("/api/openapi.json").json()
    return schema


@pytest.fixture
def caching_off(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """The API as run locally, where caching is off."""
    monkeypatch.setenv("CACHE_RESPONSES", "false")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
