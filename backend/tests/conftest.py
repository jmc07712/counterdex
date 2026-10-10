import os
from collections.abc import Iterator

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text
from sqlalchemy.orm import Session

# Point the app at the test database before any test connects, so tests can never touch
# development data. Environment variables beat backend/.env; export TEST_DATABASE_URL in your
# shell to use a different test database.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://counterdex:counterdex@localhost:5432/counterdex_test",
)


@pytest.fixture(scope="session")
def alembic_config() -> Config:
    config = Config()
    config.set_main_option("script_location", "app:migrations")
    return config


@pytest.fixture(scope="session")
def migrated_engine(alembic_config: Config) -> Engine:
    """The test database, upgraded to the latest migration once per test run."""
    from app.core.db import get_engine

    engine = get_engine()
    with engine.connect() as connection:
        database = connection.execute(text("select current_database()")).scalar_one()
    assert database.endswith("_test"), f"refusing to migrate non-test database {database!r}"

    command.upgrade(alembic_config, "head")
    return engine


@pytest.fixture
def db_session(migrated_engine: Engine) -> Iterator[Session]:
    """A session whose changes are rolled back after each test, even if the code commits."""
    with migrated_engine.connect() as connection:
        transaction = connection.begin()
        session = Session(bind=connection, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            session.close()
            transaction.rollback()


@pytest.fixture
def client() -> Iterator[TestClient]:
    from app.main import app

    # The context manager runs the app's startup and shutdown, as a real server would.
    with TestClient(app) as test_client:
        yield test_client
