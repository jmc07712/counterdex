import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.accounts.models import User
from app.accounts.types import SignedIn


def test_errors_leave_out_the_values_sent(db_session: Session, ash: SignedIn) -> None:
    # Errors end up in logs, and values can be secrets such as password hashes.
    db_session.add(User(username="ASH", password_hash="$argon2id$not-for-logs"))

    with pytest.raises(IntegrityError) as error:
        db_session.flush()

    assert "not-for-logs" not in str(error.value)
