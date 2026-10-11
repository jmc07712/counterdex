from collections.abc import Iterator

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, make_url, text

from app.accounts.models import User, UserSession
from app.core.db import Base
from app.pokemon.models import Pokemon
from app.sync.models import PokemonChange, SyncRun
from app.teams.models import Team, TeamMember

# Imported so their tables are registered on Base.metadata, as in app/migrations/env.py.
MODELS = (Pokemon, PokemonChange, SyncRun, User, UserSession, Team, TeamMember)
# The migration before species were marked legendary or mythical.
BEFORE_SPECIES_FLAGS = "1f8216da36fa"
# Each CHECK constraint's table, name and definition, as Postgres normalizes it.
CHECK_CONSTRAINTS = text(
    "select conrelid::regclass::text, conname, pg_get_constraintdef(oid) from pg_constraint"
    " where contype = 'c' and connamespace = 'public'::regnamespace"
)


@pytest.fixture
def engine_from_models(migrated_engine: Engine, postgres_url: str) -> Iterator[Engine]:
    """A second database in the test container, built straight from the models."""
    admin = migrated_engine.execution_options(isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text("create database from_models"))
    engine = create_engine(make_url(postgres_url).set(database="from_models"))
    try:
        Base.metadata.create_all(engine)
        yield engine
    finally:
        engine.dispose()
        with admin.connect() as connection:
            connection.execute(text("drop database from_models"))


def check_constraints(engine: Engine) -> set[tuple[str, str, str]]:
    with engine.connect() as connection:
        return {(table, name, sql) for table, name, sql in connection.execute(CHECK_CONSTRAINTS)}


def test_migrations_match_the_models(alembic_config: Config, migrated_engine: Engine) -> None:
    # Fails if a table, column, type, nullability, index or unique constraint in the models has
    # no matching migration. Alembic doesn't compare CHECK constraints; the next test does.
    command.check(alembic_config)


def test_migrations_create_the_models_check_constraints(
    migrated_engine: Engine, engine_from_models: Engine
) -> None:
    # A CHECK added, removed or changed in a model without a migration (or the reverse) fails
    # here, e.g. a new PokemonType that the database would still reject.
    assert check_constraints(migrated_engine) == check_constraints(engine_from_models)


def test_migrations_can_be_rolled_back_and_reapplied(
    alembic_config: Config, migrated_engine: Engine
) -> None:
    command.downgrade(alembic_config, "base")
    command.upgrade(alembic_config, "head")


def test_species_stored_before_the_flags_are_neither_legendary_nor_mythical(
    alembic_config: Config, migrated_engine: Engine
) -> None:
    # Until the next sync fills them in.
    command.downgrade(alembic_config, BEFORE_SPECIES_FLAGS)
    try:
        with migrated_engine.begin() as connection:
            connection.execute(
                text(
                    "insert into species (id, name, evolution_chain_id, evolution_methods)"
                    " values (6, 'charizard', 2, '[]')"
                )
            )
        command.upgrade(alembic_config, "head")

        with migrated_engine.connect() as connection:
            flags = connection.execute(
                text("select is_legendary, is_mythical from species where id = 6")
            ).one()
        assert tuple(flags) == (False, False)
    finally:
        command.upgrade(alembic_config, "head")
        with migrated_engine.begin() as connection:
            connection.execute(text("delete from species where id = 6"))
