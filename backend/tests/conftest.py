from collections.abc import Callable, Iterator

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from sqlalchemy import Connection, Engine, text
from sqlalchemy.orm import Session, sessionmaker
from testcontainers.community.postgres import PostgresContainer

from app.accounts import passwords, service
from app.accounts.types import SignedIn
from app.core.config import get_settings
from app.core.db import Base, get_engine, get_session
from app.pokemon import models
from tests.support.accounts import ASH, MISTY, OAK, sign_up_admin
from tests.support.counter import REAL_POKEMON, add_real_pokemon, add_type_chart
from tests.support.pokemon import LEVEL_16, LEVEL_36, add_species, make_pokemon

# Same major version as production (Neon) and docker-compose.yml.
POSTGRES_IMAGE = "postgres:17-alpine"

# Argon2id at its lowest cost. At the real cost, hashing the passwords of the users the tests
# sign up took half the run.
CHEAP_HASHER = PasswordHash((Argon2Hasher(time_cost=1, memory_cost=8, parallelism=1),))


@pytest.fixture(autouse=True)
def cheap_password_hashing(monkeypatch: pytest.MonkeyPatch) -> None:
    """Passwords hashed with CHEAP_HASHER; test_passwords.py turns this off."""
    monkeypatch.setattr(passwords, "_hasher", CHEAP_HASHER)


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
def sessions(connection: Connection) -> Callable[[], Session]:
    """Sessions whose commits stay inside the test's transaction, which is rolled back."""
    return lambda: Session(bind=connection, join_transaction_mode="create_savepoint")


@pytest.fixture
def db_session(sessions: Callable[[], Session]) -> Iterator[Session]:
    """A session whose changes are rolled back after each test, even if the code commits."""
    with sessions() as session:
        yield session


@pytest.fixture
def committing_sessions(migrated_engine: Engine) -> Iterator[sessionmaker[Session]]:
    """Sessions on their own connections that really commit, for tests of requests that overlap.

    Every table is emptied afterwards, as the other tests expect an empty database.
    """
    yield sessionmaker(migrated_engine)
    tables = ", ".join(f'"{table.name}"' for table in Base.metadata.sorted_tables)
    with migrated_engine.begin() as connection:
        connection.execute(text(f"truncate {tables} restart identity cascade"))


@pytest.fixture
def client(sessions: Callable[[], Session]) -> Iterator[TestClient]:
    """The app, on the test's rolled-back connection so it sees the rows each test adds.

    Each request gets its own session, as in production, so what a route doesn't commit is
    undone when the request ends.
    """
    from app.api.main import app

    def request_session() -> Iterator[Session]:
        with sessions() as session:
            yield session

    app.dependency_overrides[get_session] = request_session
    # The context manager runs the app's startup and shutdown, as a real server would. Over
    # https, as in production, or the client wouldn't send back Secure cookies.
    with TestClient(app, base_url="https://testserver") as test_client:
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


@pytest.fixture
def pokedex(db_session: Session) -> None:
    """The type chart, and every real Pokémon in tests.support.counter with its species and
    evolution family, as a sync would store them.
    """
    add_type_chart(db_session)
    add_real_pokemon(db_session, *REAL_POKEMON)


@pytest.fixture
def ash(db_session: Session) -> SignedIn:
    """Ash, signed up and so signed in, with the password in tests.support.accounts.ASH."""
    return service.sign_up(db_session, ASH)


@pytest.fixture
def misty(db_session: Session) -> SignedIn:
    """Misty, signed up and so signed in: a second user."""
    return service.sign_up(db_session, MISTY)


@pytest.fixture
def oak(db_session: Session) -> SignedIn:
    """Oak, signed up as an admin and so signed in: see tests.support.accounts.sign_up_admin."""
    return sign_up_admin(db_session, OAK)
