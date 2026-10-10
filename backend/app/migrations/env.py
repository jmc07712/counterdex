"""Alembic environment: migrates the database to match the models.

Connects directly (DATABASE_URL_UNPOOLED) when there's a pooler in front, else DATABASE_URL.
"""

import logging

from alembic import context
from sqlalchemy import create_engine, pool

from app.accounts.models import User, UserSession
from app.core.config import get_settings
from app.core.db import Base
from app.pokemon.models import Pokemon
from app.sync.models import PokemonChange, SyncRun

# Importing each domain's models registers their tables on Base.metadata; list new ones here.
MODELS = (Pokemon, PokemonChange, SyncRun, User, UserSession)

config = context.config
target_metadata = Base.metadata
database_url = get_settings().migration_database_url

if config.cmd_opts is not None:
    # Running from the alembic CLI: show which migrations run. Tests keep their own logging.
    logging.basicConfig(format="%(levelname)-5.5s [%(name)s] %(message)s")
    logging.getLogger("alembic").setLevel(logging.INFO)


def run_migrations_offline() -> None:
    """Print the SQL instead of running it (`alembic upgrade head --sql`)."""
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # A migration run is a one-off process, so there are no connections worth pooling.
    engine = create_engine(database_url, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
