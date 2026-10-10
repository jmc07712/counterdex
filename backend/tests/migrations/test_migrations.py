from alembic import command
from alembic.config import Config
from sqlalchemy import Engine


def test_migrations_match_the_models(alembic_config: Config, migrated_engine: Engine) -> None:
    # Fails if a table, column, type, nullability, index or unique constraint in the models has
    # no matching migration. Alembic doesn't compare CHECK constraints; the model tests cover
    # those by exercising them against the migrated database.
    command.check(alembic_config)


def test_migrations_can_be_rolled_back_and_reapplied(
    alembic_config: Config, migrated_engine: Engine
) -> None:
    command.downgrade(alembic_config, "base")
    command.upgrade(alembic_config, "head")
