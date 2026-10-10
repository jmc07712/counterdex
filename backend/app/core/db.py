from collections.abc import Iterator
from enum import StrEnum
from functools import lru_cache

from sqlalchemy import Engine, Enum, MetaData, create_engine
from sqlalchemy.orm import DeclarativeBase, Session

from app.core.config import get_settings


class Base(DeclarativeBase):
    """Base class for every table. Each domain defines its tables in its own models.py."""

    # Predictable constraint names, so migrations can reference them and errors are readable.
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(column_0_label)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "ck": "ck_%(table_name)s_%(constraint_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


def text_enum(enum_class: type[StrEnum], *, check_name: str) -> Enum:
    """A column type storing a StrEnum's values as text, limited to them by a CHECK constraint.

    Not a Postgres ENUM type: those can't drop values and are awkward to change in migrations.
    """
    return Enum(
        enum_class,
        name=check_name,
        native_enum=False,
        create_constraint=True,
        length=None,
        # Store "succeeded", not the member's name "SUCCEEDED".
        values_callable=lambda members: [member.value for member in members],
    )


@lru_cache
def get_engine() -> Engine:
    # pool_pre_ping replaces connections the server closed while idle (Neon scales to zero).
    return create_engine(get_settings().database_url, pool_pre_ping=True)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: one session per request, always closed afterwards."""
    with Session(get_engine()) as session:
        yield session
