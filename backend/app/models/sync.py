from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Identity, Index, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SyncRun(Base):
    """One run of the PokéAPI sync, successful or not."""

    __tablename__ = "sync_runs"
    __table_args__ = (CheckConstraint("status in ('succeeded', 'failed')", name="known_status"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(Text)
    fetched: Mapped[int]
    inserted: Mapped[int]
    updated: Mapped[int]
    unchanged: Mapped[int]
    removed: Mapped[int]
    restored: Mapped[int]
    # PokéAPI URLs (or names, for unusable data) of Pokémon that couldn't be synced.
    failed: Mapped[list[str]] = mapped_column(JSONB)
    # Why the run failed, when it did.
    error: Mapped[str | None] = mapped_column(Text)


class PokemonChange(Base):
    """A change to a Pokémon found by a sync. Append-only: rows are never updated or deleted."""

    __tablename__ = "pokemon_changes"
    __table_args__ = (
        CheckConstraint("kind in ('updated', 'removed', 'restored')", name="known_kind"),
        # Alerts look up recent changes for the Pokémon on a user's teams.
        Index("ix_pokemon_changes_pokemon_id_detected_at", "pokemon_id", "detected_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(), primary_key=True)
    pokemon_id: Mapped[int] = mapped_column(ForeignKey("pokemon.id"))
    sync_run_id: Mapped[int] = mapped_column(ForeignKey("sync_runs.id"))
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    kind: Mapped[str] = mapped_column(Text)
    # Snapshots of the tracked fields. A removal has no `after`.
    before: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    after: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
