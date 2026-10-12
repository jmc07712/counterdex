import logging
from collections.abc import Callable

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.accounts.models import User
from app.accounts.types import SignedIn
from app.jobs.make_admin import main


def admins(sessions: Callable[[], Session]) -> list[str]:
    """The usernames of the admins, as a new session sees them."""
    with sessions() as session:
        return list(session.scalars(select(User.username).where(User.is_admin).order_by(User.id)))


def test_makes_a_user_an_admin(
    sessions: Callable[[], Session],
    caplog: pytest.LogCaptureFixture,
    ash: SignedIn,
    misty: SignedIn,
) -> None:
    caplog.set_level(logging.INFO)

    exit_code = main(["ash"], sessions)

    assert exit_code == 0
    assert admins(sessions) == ["ash"]
    assert caplog.messages == ["ash is now an admin"]


def test_takes_admin_away_with_revoke(
    sessions: Callable[[], Session], caplog: pytest.LogCaptureFixture, oak: SignedIn
) -> None:
    caplog.set_level(logging.INFO)

    exit_code = main(["oak", "--revoke"], sessions)

    assert exit_code == 0
    assert admins(sessions) == []
    assert caplog.messages == ["oak is no longer an admin"]


def test_exits_non_zero_for_a_username_no_one_has(
    sessions: Callable[[], Session], caplog: pytest.LogCaptureFixture, oak: SignedIn
) -> None:
    exit_codes = [main(["gary"], sessions), main(["gary", "--revoke"], sessions)]

    assert exit_codes == [1, 1]
    assert admins(sessions) == ["oak"]
    assert caplog.messages == ["No user has the username gary."] * 2


def test_needs_a_username(sessions: Callable[[], Session]) -> None:
    with pytest.raises(SystemExit) as exit_info:
        main([], sessions)

    assert exit_info.value.code == 2
