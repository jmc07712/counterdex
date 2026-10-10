from collections.abc import Iterator

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session
from testcontainers.community.postgres import PostgresContainer

from app.core.config import get_settings
from app.core.db import get_engine, get_session

# Same major version as production (Neon) and docker-compose.yml.
POSTGRES_IMAGE = "postgres:17-alpine"


@pytest.fixture
def anyio_backend() -> str:
    # Async tests run on asyncio only (AnyIO's pytest plugin would also try trio).
    return "asyncio"


@pytest.fixture(scope="session")
def postgres_url() -> Iterator[str]:
    """A throwaway Postgres for this test run, started on first use and removed afterwards.

    Tests never touch the docker-compose database used for development.
    """
    with PostgresContainer(POSTGRES_IMAGE, driver="psycopg") as postgres:
        yield postgres.get_connection_url()


@pytest.fixture(scope="session")
def alembic_config() -> Config:
    config = Config()
    config.set_main_option("script_location", "app:migrations")
    return config


@pytest.fixture(scope="session")
def migrated_engine(postgres_url: str, alembic_config: Config) -> Iterator[Engine]:
    """The test database, upgraded to the latest migration once per test run."""
    with pytest.MonkeyPatch.context() as env:
        env.setenv("DATABASE_URL", postgres_url)
        get_settings.cache_clear()
        get_engine.cache_clear()

        command.upgrade(alembic_config, "head")
        engine = get_engine()
        yield engine

        engine.dispose()
        get_settings.cache_clear()
        get_engine.cache_clear()


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
def client(db_session: Session) -> Iterator[TestClient]:
    """The app, using the test's rolled-back session so it sees the rows each test adds."""
    from app.api.main import app

    app.dependency_overrides[get_session] = lambda: db_session
    # The context manager runs the app's startup and shutdown, as a real server would.
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_session)
