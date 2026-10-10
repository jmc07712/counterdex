from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

STAT_COLUMNS = ("hp", "attack", "defense", "sp_attack", "sp_defense", "speed")


class Pokemon(Base):
    """Our copy of the PokéAPI fields the app uses, kept current by the sync job."""

    __tablename__ = "pokemon"
    __table_args__ = (
        CheckConstraint("cardinality(types) between 1 and 2", name="one_or_two_types"),
        *(
            CheckConstraint(f"{stat} between 1 and 255", name=f"{stat}_in_range")
            for stat in STAT_COLUMNS
        ),
    )

    # PokéAPI's own id, so it isn't generated here.
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=False)
    name: Mapped[str] = mapped_column(Text, unique=True)
    # In slot order; PokéAPI lists a Pokémon's primary type first.
    types: Mapped[list[str]] = mapped_column(ARRAY(Text))
    hp: Mapped[int] = mapped_column(SmallInteger)
    attack: Mapped[int] = mapped_column(SmallInteger)
    defense: Mapped[int] = mapped_column(SmallInteger)
    sp_attack: Mapped[int] = mapped_column(SmallInteger)
    sp_defense: Mapped[int] = mapped_column(SmallInteger)
    speed: Mapped[int] = mapped_column(SmallInteger)
    sprite_url: Mapped[str | None] = mapped_column(Text)
    # False for alternate forms (megas, regional variants, etc.).
    is_default: Mapped[bool]
    # SHA-256 of the tracked fields; lets the sync job skip unchanged Pokémon cheaply.
    content_hash: Mapped[str] = mapped_column(String(64))
    last_synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
