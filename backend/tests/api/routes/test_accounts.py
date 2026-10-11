from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from http.cookies import Morsel, SimpleCookie
from typing import Any

import httpx2
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.accounts.constants import SESSION_LIFETIME
from app.accounts.models import UserSession
from app.accounts.tokens import hash_token
from app.accounts.types import SignedIn
from tests.support.accounts import ASH, expire_in

ASH_JSON = {"username": ASH.username, "password": ASH.password.get_secret_value()}


def session_cookie(response: httpx2.Response) -> Morsel[str]:
    """The session cookie a response sets, with its attributes."""
    (morsel,) = SimpleCookie(response.headers["set-cookie"]).values()
    return morsel


# --- Signing up ---


def test_signing_up_signs_you_in(client: TestClient) -> None:
    response = client.post("/api/users", json=ASH_JSON)

    assert response.status_code == 201
    assert response.json() == {"id": response.json()["id"], "username": "ash", "is_admin": False}
    assert client.get("/api/session").json() == response.json()


def test_a_taken_username_is_a_conflict(client: TestClient, ash: SignedIn) -> None:
    response = client.post("/api/users", json={**ASH_JSON, "username": "ASH"})

    assert response.status_code == 409
    assert "set-cookie" not in response.headers


@pytest.mark.parametrize(
    "body",
    [
        pytest.param({**ASH_JSON, "password": "pikachu"}, id="short-password"),
        pytest.param({**ASH_JSON, "username": "ash ketchum"}, id="username-with-a-space"),
        pytest.param({"username": "ash"}, id="no-password"),
    ],
)
def test_rejects_invalid_credentials(client: TestClient, body: dict[str, Any]) -> None:
    assert client.post("/api/users", json=body).status_code == 422


def test_rejecting_a_password_doesnt_repeat_it(client: TestClient) -> None:
    response = client.post("/api/users", json={**ASH_JSON, "password": "pikachu"})

    assert response.status_code == 422
    assert "pikachu" not in response.text


# --- Signing in ---


def test_signs_in_with_the_right_password(client: TestClient, ash: SignedIn) -> None:
    response = client.post("/api/session", json=ASH_JSON)

    assert response.status_code == 200
    assert response.json() == {"id": ash.user.id, "username": "ash", "is_admin": False}
    assert client.get("/api/session").json() == response.json()


@pytest.mark.parametrize(
    "body",
    [
        pytest.param({**ASH_JSON, "password": "raichu-i-choose-you"}, id="wrong-password"),
        pytest.param({**ASH_JSON, "username": "gary"}, id="unknown-username"),
        # Sign-up's rules don't apply: a guess no account could have is just wrong.
        pytest.param({**ASH_JSON, "password": "pikachu"}, id="password-too-short-for-any"),
        pytest.param({**ASH_JSON, "username": "ash ketchum"}, id="username-no-account-has"),
    ],
)
def test_wrong_credentials_are_unauthorized(
    client: TestClient, ash: SignedIn, body: dict[str, str]
) -> None:
    response = client.post("/api/session", json=body)

    assert response.status_code == 401
    assert response.json() == {"detail": "Wrong username or password."}
    assert "set-cookie" not in response.headers


# --- The session cookie ---


def test_the_cookie_is_secure_and_hidden_from_scripts(client: TestClient, ash: SignedIn) -> None:
    cookie = session_cookie(client.post("/api/session", json=ASH_JSON))

    assert cookie.key == "__Host-session"
    assert (cookie["secure"], cookie["httponly"], cookie["samesite"]) == (True, True, "strict")
    assert (cookie["path"], cookie["domain"]) == ("/", "")


@pytest.mark.usefixtures("running_locally")
def test_the_cookie_works_over_plain_http_locally(client: TestClient, ash: SignedIn) -> None:
    cookie = session_cookie(client.post("/api/session", json=ASH_JSON))

    assert cookie.key == "session"
    assert not cookie["secure"]


def test_the_cookie_expires_with_its_session(client: TestClient, ash: SignedIn) -> None:
    before = datetime.now(UTC).replace(microsecond=0)
    cookie = session_cookie(client.post("/api/session", json=ASH_JSON))

    assert parsedate_to_datetime(cookie["expires"]) >= before + SESSION_LIFETIME


def test_using_a_session_late_in_its_life_renews_the_cookie(
    ash_client: TestClient, db_session: Session, ash: SignedIn
) -> None:
    expire_in(db_session, ash.token, timedelta(days=1))
    before = datetime.now(UTC).replace(microsecond=0)

    cookie = session_cookie(ash_client.get("/api/session"))

    assert cookie.value == ash.token
    assert parsedate_to_datetime(cookie["expires"]) >= before + SESSION_LIFETIME


def test_a_renewal_is_saved(ash_client: TestClient, db_session: Session, ash: SignedIn) -> None:
    expire_in(db_session, ash.token, timedelta(days=1))
    before = datetime.now(UTC)

    ash_client.get("/api/session")

    db_session.expire_all()
    stored = db_session.get_one(UserSession, hash_token(ash.token))
    assert stored.expires_at >= before + SESSION_LIFETIME


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("POST", "/api/users", {**ASH_JSON, "username": "misty"}),
        ("POST", "/api/session", ASH_JSON),
        ("GET", "/api/session", None),
        ("DELETE", "/api/session", None),
    ],
)
def test_responses_are_never_cached(
    ash_client: TestClient, method: str, path: str, body: dict[str, str] | None
) -> None:
    response = ash_client.request(method, path, json=body)

    assert response.is_success
    assert response.headers["cache-control"] == "no-store"


# --- Who's signed in ---


def test_says_who_is_signed_in(ash_client: TestClient, ash: SignedIn) -> None:
    assert ash_client.get("/api/session").json() == ash.user.model_dump()


@pytest.mark.usefixtures("running_locally")
def test_the_cookie_signs_you_in_over_plain_http_locally(client: TestClient, ash: SignedIn) -> None:
    client.cookies.set("session", ash.token)

    assert client.get("/api/session").json() == ash.user.model_dump()


def test_nobody_is_signed_in_without_a_cookie(client: TestClient) -> None:
    response = client.get("/api/session")

    assert response.status_code == 401
    assert response.json() == {
        "detail": (
            "Sign in first: POST /api/session with your username and password sets the "
            "session cookie."
        )
    }


def test_an_expired_session_signs_nobody_in(
    ash_client: TestClient, db_session: Session, ash: SignedIn
) -> None:
    expire_in(db_session, ash.token, timedelta(seconds=-1))

    assert ash_client.get("/api/session").status_code == 401


# --- Signing out ---


def test_signing_out_ends_the_session(
    ash_client: TestClient, db_session: Session, ash: SignedIn
) -> None:
    response = ash_client.delete("/api/session")

    assert response.status_code == 204
    assert session_cookie(response).value == ""
    # Ended on the server, not just in this browser: a copy of the cookie no longer works.
    ash_client.cookies.set("__Host-session", ash.token)
    assert ash_client.get("/api/session").status_code == 401


def test_signing_out_when_signed_out_is_harmless(client: TestClient) -> None:
    assert client.delete("/api/session").status_code == 204
