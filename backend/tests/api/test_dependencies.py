from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Connection, update
from sqlalchemy.orm import Session

from app.accounts import models
from app.accounts.schemas import User
from app.accounts.types import SignedIn
from app.api.dependencies import AdminUser
from app.api.session_cookie import session_cookie_name
from app.core.db import get_session


@pytest.fixture
def admin_app(connection: Connection) -> FastAPI:
    """An app with one route that only admins can use, on the test's rolled-back connection."""
    app = FastAPI()

    @app.get("/admin-only")
    def admin_only(admin: AdminUser) -> User:
        return admin

    def request_session() -> Iterator[Session]:
        with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
            yield session

    app.dependency_overrides[get_session] = request_session
    return app


@pytest.fixture
def admin_client(admin_app: FastAPI) -> Iterator[TestClient]:
    with TestClient(admin_app, base_url="https://testserver") as client:
        yield client


def test_turns_away_who_is_not_signed_in(admin_client: TestClient) -> None:
    assert admin_client.get("/admin-only").status_code == 401


def test_turns_away_who_is_not_an_admin(admin_client: TestClient, ash: SignedIn) -> None:
    admin_client.cookies.set(session_cookie_name(), ash.token)

    response = admin_client.get("/admin-only")

    assert response.status_code == 403
    assert response.json() == {"detail": "Only admins can see this."}


def test_lets_an_admin_through(admin_client: TestClient, oak: SignedIn) -> None:
    admin_client.cookies.set(session_cookie_name(), oak.token)

    response = admin_client.get("/admin-only")

    assert response.status_code == 200
    assert response.json() == {"id": oak.user.id, "username": "oak", "is_admin": True}


def test_taking_admin_away_works_at_once(
    admin_client: TestClient, db_session: Session, oak: SignedIn
) -> None:
    admin_client.cookies.set(session_cookie_name(), oak.token)
    assert admin_client.get("/admin-only").status_code == 200

    db_session.execute(
        update(models.User).where(models.User.id == oak.user.id).values(is_admin=False)
    )

    assert admin_client.get("/admin-only").status_code == 403


def test_the_docs_mark_the_route_as_needing_the_session_cookie(admin_app: FastAPI) -> None:
    operation = admin_app.openapi()["paths"]["/admin-only"]["get"]

    assert operation["security"] == [{"SessionCookie": []}]
