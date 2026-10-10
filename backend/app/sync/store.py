"""Write a sync's Pokémon to the database and work out what changed."""

from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import RowMapping, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.pokemon import models, schemas
from app.sync.constants import MAX_REMOVED_SHARE, MIN_REMOVALS_ALLOWED
from app.sync.exceptions import SuspiciousRemovalError
from app.sync.normalize import content_hash
from app.sync.types import Change, StoreResult

# Every column except the id, which identifies the row being written.
WRITABLE_COLUMNS = tuple(
    column.name for column in models.Pokemon.__table__.columns if column.name != "id"
)


def store_pokemon(
    session: Session,
    pokemon: Sequence[schemas.Pokemon],
    *,
    listed_ids: set[int],
    synced_at: datetime,
) -> StoreResult:
    """Bring the pokemon table in line with PokéAPI and report what changed.

    New Pokémon are inserted without a change (nobody can have them on a team yet). Updates,
    removals and restorations come back as changes with before/after snapshots taken before
    any row is overwritten. Only Pokémon missing from `listed_ids` count as removed, and rows
    are never deleted.
    """
    current = {
        row["id"]: row for row in session.execute(select(models.Pokemon.__table__)).mappings()
    }
    changes: list[Change] = []
    to_write: list[schemas.Pokemon] = []
    unchanged_ids: list[int] = []
    inserted = updated = restored = 0

    for fetched in pokemon:
        row = current.get(fetched.id)
        if row is None:
            inserted += 1
            to_write.append(fetched)
        elif row["removed_at"] is not None:
            restored += 1
            changes.append(Change(fetched.id, "restored", _row_snapshot(row), _snapshot(fetched)))
            to_write.append(fetched)
        elif row["content_hash"] != content_hash(fetched):
            updated += 1
            changes.append(Change(fetched.id, "updated", _row_snapshot(row), _snapshot(fetched)))
            to_write.append(fetched)
        else:
            unchanged_ids.append(fetched.id)

    removed_ids = [
        pokemon_id
        for pokemon_id, row in current.items()
        if pokemon_id not in listed_ids and row["removed_at"] is None
    ]
    _check_removals(len(removed_ids), total=len(current))
    changes.extend(
        Change(pokemon_id, "removed", _row_snapshot(current[pokemon_id]), None)
        for pokemon_id in removed_ids
    )

    if to_write:
        statement = insert(models.Pokemon).values([_row(each, synced_at) for each in to_write])
        session.execute(
            statement.on_conflict_do_update(
                index_elements=[models.Pokemon.id],
                set_={column: statement.excluded[column] for column in WRITABLE_COLUMNS},
            )
        )
    if unchanged_ids:
        session.execute(
            update(models.Pokemon)
            .where(models.Pokemon.id.in_(unchanged_ids))
            .values(last_synced_at=synced_at)
        )
    if removed_ids:
        session.execute(
            update(models.Pokemon)
            .where(models.Pokemon.id.in_(removed_ids))
            .values(removed_at=synced_at)
        )

    return StoreResult(
        inserted=inserted,
        updated=updated,
        unchanged=len(unchanged_ids),
        removed=len(removed_ids),
        restored=restored,
        changes=changes,
    )


def _check_removals(removed: int, *, total: int) -> None:
    allowed = max(MIN_REMOVALS_ALLOWED, int(total * MAX_REMOVED_SHARE))
    if removed > allowed:
        raise SuspiciousRemovalError(
            f"refusing to remove {removed} of {total} Pokémon in one sync (limit {allowed})"
        )


def _snapshot(pokemon: schemas.Pokemon) -> dict[str, Any]:
    """The tracked fields a change records: the Pokémon's columns, minus the id it's filed under."""
    columns = pokemon.to_columns()
    del columns["id"]
    return columns


def _row_snapshot(row: RowMapping) -> dict[str, Any]:
    return _snapshot(schemas.Pokemon.from_columns(row))


def _row(pokemon: schemas.Pokemon, synced_at: datetime) -> dict[str, Any]:
    return pokemon.to_columns() | {
        "content_hash": content_hash(pokemon),
        "last_synced_at": synced_at,
        # A restored Pokémon is listed again.
        "removed_at": None,
    }
