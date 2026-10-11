from collections.abc import Callable

import pytest
from sqlalchemy import Connection
from sqlalchemy.orm import Session


@pytest.fixture
def sessions(connection: Connection) -> Callable[[], Session]:
    """Sessions whose commits stay inside the test's transaction, which is rolled back."""
    return lambda: Session(bind=connection, join_transaction_mode="create_savepoint")
