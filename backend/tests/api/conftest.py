from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.accounts.types import SignedIn
from app.api.session_cookie import session_cookie_name
from app.core.config import get_settings


@pytest.fixture
def openapi(client: TestClient) -> dict[str, Any]:
    """The OpenAPI schema the API serves."""
    schema: dict[str, Any] = client.get("/api/openapi.json").json()
    return schema


@pytest.fixture
def ash_client(client: TestClient, ash: SignedIn) -> TestClient:
    """The client, signed in as Ash."""
    client.cookies.set(session_cookie_name(), ash.token)
    return client


@pytest.fixture
def running_locally(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """The API configured as .env.example configures it for local development."""
    monkeypatch.setenv("CACHE_RESPONSES", "false")
    monkeypatch.setenv("SECURE_COOKIES", "false")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
