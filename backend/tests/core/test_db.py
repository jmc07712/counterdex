import pytest
from sqlalchemy import Engine, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.accounts.models import User
from app.accounts.types import SignedIn
from app.core.db import get_engine


def test_engine_connects_to_the_test_run_database(
    postgres_url: str, migrated_engine: Engine
) -> None:
    assert get_engine().url.render_as_string(hide_password=False) == postgres_url

    with get_engine().connect() as connection:
        version = connection.execute(text("show server_version")).scalar_one()

    assert version.startswith("17.")


def test_errors_leave_out_the_values_sent(db_session: Session, ash: SignedIn) -> None:
    # Errors end up in logs, and values can be secrets such as password hashes.
    db_session.add(User(username="ASH", password_hash="$argon2id$not-for-logs"))

    with pytest.raises(IntegrityError) as error:
        db_session.flush()

    assert "not-for-logs" not in str(error.value)
