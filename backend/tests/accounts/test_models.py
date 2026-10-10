import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.accounts.models import User, UserSession
from app.accounts.types import SignedIn


def test_rejects_usernames_the_api_would(db_session: Session) -> None:
    db_session.add(User(username="ash ketchum", password_hash="$argon2id$..."))

    with pytest.raises(IntegrityError, match="ck_users_valid_username"):
        db_session.flush()


def test_usernames_are_unique_ignoring_case(db_session: Session, ash: SignedIn) -> None:
    db_session.add(User(username="ASH", password_hash="$argon2id$..."))

    with pytest.raises(IntegrityError, match="uq_users_lower_username"):
        db_session.flush()


def test_deleting_a_user_ends_their_sessions(db_session: Session, ash: SignedIn) -> None:
    db_session.execute(delete(User))

    assert db_session.scalar(select(func.count()).select_from(UserSession)) == 0
