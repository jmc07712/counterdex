from collections.abc import Iterator

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Connection, Engine
from sqlalchemy.orm import Session
from testcontainers.community.postgres import PostgresContainer

from app.core.config import get_settings
from app.core.db import get_engine, get_session
from app.pokemon import models
from tests.support.pokemon import LEVEL_16, LEVEL_36, add_species, make_pokemon

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
def connection(migrated_engine: Engine) -> Iterator[Connection]:
    """A connection whose transaction is rolled back after each test."""
    with migrated_engine.connect() as connection:
        transaction = connection.begin()
        try:
            yield connection
        finally:
            transaction.rollback()


@pytest.fixture
def db_session(connection: Connection) -> Iterator[Session]:
    """A session whose changes are rolled back after each test, even if the code commits."""
    with Session(bind=connection, join_transaction_mode="create_savepoint") as session:
        yield session


@pytest.fixture
def client(db_session: Session) -> Iterator[TestClient]:
    """The app, using the test's rolled-back session so it sees the rows each test adds."""
    from app.api.main import app

    app.dependency_overrides[get_session] = lambda: db_session
    # The context manager runs the app's startup and shutdown, as a real server would.
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_session)


@pytest.fixture
def gyarados(db_session: Session) -> models.Pokemon:
    """Gyarados (130), stored; see make_pokemon."""
    pokemon = make_pokemon()
    db_session.add(pokemon)
    db_session.flush()
    return pokemon


@pytest.fixture
def charmander_family(db_session: Session) -> None:
    """Charmander (4), Charmeleon (5), and Charizard (6) with its Mega Charizard X (10034),
    stored as Pokémon and as the species of one evolution family (2).
    """
    db_session.add_all(
        [
            make_pokemon(id=4, name="charmander", types=["fire"]),
            make_pokemon(id=5, name="charmeleon", types=["fire"]),
            make_pokemon(id=6, name="charizard", types=["fire", "flying"]),
            make_pokemon(
                id=10034, name="charizard-mega-x", types=["fire", "dragon"], is_default=False
            ),
        ]
    )
    db_session.flush()
    add_species(db_session, 4, family=2, pokemon_ids=[4], name="charmander", genus="Lizard Pokémon")
    add_species(
        db_session,
        5,
        family=2,
        evolves_from=4,
        methods=[LEVEL_16],
        pokemon_ids=[5],
        name="charmeleon",
        genus="Flame Pokémon",
    )
    add_species(
        db_session,
        6,
        family=2,
        evolves_from=5,
        methods=[LEVEL_36],
        pokemon_ids=[6, 10034],
        name="charizard",
        genus="Flame Pokémon",
    )
