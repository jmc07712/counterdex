from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete, event, select
from sqlalchemy.orm import ORMExecuteState, Session

from app.accounts import service
from app.accounts.constants import SESSION_LIFETIME
from app.accounts.exceptions import UsernameTakenError
from app.accounts.models import User, UserSession
from app.accounts.passwords import verify_password
from app.accounts.schemas import Credentials, NewAccount
from app.accounts.tokens import hash_token
from app.accounts.types import SignedIn
from tests.support.accounts import ASH, expire_in

# --- Signing up ---


def test_signing_up_stores_the_username_and_a_hash_of_the_password(db_session: Session) -> None:
    signed_in = service.sign_up(db_session, ASH)

    user = db_session.get_one(User, signed_in.user.id)
    assert user.username == "ash"
    assert "pikachu" not in user.password_hash
    assert verify_password(ASH.password.get_secret_value(), user.password_hash)


def test_signing_up_signs_you_in(db_session: Session) -> None:
    signed_in = service.sign_up(db_session, ASH)

    assert service.find_signed_in(db_session, signed_in.token) == signed_in


def test_new_users_are_not_admins(ash: SignedIn) -> None:
    assert ash.user.is_admin is False


def test_a_username_is_taken_whatever_its_case(db_session: Session, ash: SignedIn) -> None:
    with pytest.raises(UsernameTakenError):
        service.sign_up(db_session, NewAccount(username="ASH", password="a-different-one"))


# --- Signing in ---


@pytest.mark.parametrize("username", ["ash", "ASH"])
def test_signs_in_with_the_right_password(
    db_session: Session, ash: SignedIn, username: str
) -> None:
    signed_in = service.sign_in(db_session, Credentials(username=username, password=ASH.password))

    assert signed_in is not None
    assert signed_in.user == ash.user


@pytest.mark.parametrize(
    "credentials",
    [
        pytest.param(
            Credentials(username="ash", password="raichu-i-choose-you"), id="wrong-password"
        ),
        pytest.param(Credentials(username="gary", password=ASH.password), id="unknown-username"),
    ],
)
def test_refuses_wrong_credentials(
    db_session: Session, ash: SignedIn, credentials: Credentials
) -> None:
    assert service.sign_in(db_session, credentials) is None


def test_an_unknown_username_still_costs_a_password_check(
    db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    checked: list[str | None] = []

    def verify(password: str, hashed: str | None) -> bool:
        checked.append(hashed)
        return verify_password(password, hashed)

    monkeypatch.setattr(service, "verify_password", verify)

    service.sign_in(db_session, Credentials(username="gary", password="whatever"))

    assert checked == [None]


def test_each_sign_in_is_its_own_session(db_session: Session, ash: SignedIn) -> None:
    signed_in = service.sign_in(db_session, ASH)

    assert signed_in is not None
    assert signed_in.token != ash.token
    assert service.find_signed_in(db_session, ash.token) is not None


def test_signing_in_clears_the_users_expired_sessions(db_session: Session, ash: SignedIn) -> None:
    expire_in(db_session, ash.token, timedelta(seconds=-1))

    service.sign_in(db_session, ASH)

    assert db_session.get(UserSession, hash_token(ash.token)) is None


# --- Sessions ---


def test_sessions_last_30_days(db_session: Session) -> None:
    before = datetime.now(UTC)
    signed_in = service.sign_up(db_session, ASH)
    after = datetime.now(UTC)

    assert before + SESSION_LIFETIME <= signed_in.expires_at <= after + SESSION_LIFETIME


def test_stores_a_hash_of_the_token_not_the_token(db_session: Session, ash: SignedIn) -> None:
    stored = db_session.scalars(select(UserSession.token_hash)).one()

    assert stored == hash_token(ash.token)
    assert ash.token.encode() not in stored


def test_an_unknown_token_signs_nobody_in(db_session: Session, ash: SignedIn) -> None:
    assert service.find_signed_in(db_session, "not-a-real-token") is None


def test_an_expired_session_signs_nobody_in(db_session: Session, ash: SignedIn) -> None:
    expire_in(db_session, ash.token, timedelta(seconds=-1))

    assert service.find_signed_in(db_session, ash.token) is None


def test_a_session_used_in_its_second_half_is_renewed(db_session: Session, ash: SignedIn) -> None:
    expire_in(db_session, ash.token, timedelta(days=1))

    before = datetime.now(UTC)
    signed_in = service.find_signed_in(db_session, ash.token)

    assert signed_in is not None
    assert signed_in.expires_at >= before + SESSION_LIFETIME
    assert db_session.get_one(UserSession, hash_token(ash.token)).expires_at == signed_in.expires_at


def test_a_session_ended_while_being_renewed_signs_nobody_in(
    db_session: Session, ash: SignedIn
) -> None:
    expire_in(db_session, ash.token, timedelta(days=1))

    # Another request signs out just before this one renews the session.
    @event.listens_for(db_session, "do_orm_execute")
    def sign_out_first(state: ORMExecuteState) -> None:
        if state.is_update:
            state.session.connection().execute(delete(UserSession))

    assert service.find_signed_in(db_session, ash.token) is None


def test_a_session_used_in_its_first_half_is_left_alone(db_session: Session, ash: SignedIn) -> None:
    expire_in(db_session, ash.token, timedelta(days=20))
    expires_at = db_session.get_one(UserSession, hash_token(ash.token)).expires_at

    signed_in = service.find_signed_in(db_session, ash.token)

    assert signed_in is not None
    assert signed_in.expires_at == expires_at


# --- Signing out ---


def test_signing_out_ends_the_session(db_session: Session, ash: SignedIn) -> None:
    service.sign_out(db_session, ash.token)

    assert service.find_signed_in(db_session, ash.token) is None


def test_signing_out_leaves_other_sessions(db_session: Session, ash: SignedIn) -> None:
    other = service.sign_in(db_session, ASH)
    assert other is not None

    service.sign_out(db_session, ash.token)

    assert service.find_signed_in(db_session, other.token) is not None
