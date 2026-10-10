"""Write a sync's records to the database and work out what changed."""

from collections.abc import Sequence
from dataclasses import asdict, fields
from datetime import datetime
from typing import Any

from sqlalchemy import RowMapping, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.pokemon.models import Pokemon
from app.sync.constants import MAX_REMOVED_SHARE, MIN_REMOVALS_ALLOWED
from app.sync.exceptions import SuspiciousRemovalError
from app.sync.normalize import content_hash
from app.sync.types import Change, PokemonRecord, StoreResult

# The fields a change snapshot records: everything we track except the id itself.
SNAPSHOT_FIELDS = tuple(f.name for f in fields(PokemonRecord) if f.name != "id")
# Every column except the id, which identifies the row being written.
WRITABLE_COLUMNS = tuple(column.name for column in Pokemon.__table__.columns if column.name != "id")


def store_pokemon(
    session: Session,
    records: Sequence[PokemonRecord],
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
    current = {row["id"]: row for row in session.execute(select(Pokemon.__table__)).mappings()}
    changes: list[Change] = []
    to_write: list[PokemonRecord] = []
    unchanged_ids: list[int] = []
    inserted = updated = restored = 0

    for record in records:
        row = current.get(record.id)
        if row is None:
            inserted += 1
            to_write.append(record)
        elif row["removed_at"] is not None:
            restored += 1
            changes.append(Change(record.id, "restored", _row_snapshot(row), _snapshot(record)))
            to_write.append(record)
        elif row["content_hash"] != content_hash(record):
            updated += 1
            changes.append(Change(record.id, "updated", _row_snapshot(row), _snapshot(record)))
            to_write.append(record)
        else:
            unchanged_ids.append(record.id)

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
        statement = insert(Pokemon).values([_row(record, synced_at) for record in to_write])
        session.execute(
            statement.on_conflict_do_update(
                index_elements=[Pokemon.id],
                set_={column: statement.excluded[column] for column in WRITABLE_COLUMNS},
            )
        )
    if unchanged_ids:
        session.execute(
            update(Pokemon).where(Pokemon.id.in_(unchanged_ids)).values(last_synced_at=synced_at)
        )
    if removed_ids:
        session.execute(
            update(Pokemon).where(Pokemon.id.in_(removed_ids)).values(removed_at=synced_at)
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


def _snapshot(record: PokemonRecord) -> dict[str, Any]:
    values = asdict(record)
    return {name: values[name] for name in SNAPSHOT_FIELDS} | {"types": list(record.types)}


def _row_snapshot(row: RowMapping) -> dict[str, Any]:
    return {name: row[name] for name in SNAPSHOT_FIELDS} | {"types": list(row["types"])}


def _row(record: PokemonRecord, synced_at: datetime) -> dict[str, Any]:
    return asdict(record) | {
        "types": list(record.types),
        "content_hash": content_hash(record),
        "last_synced_at": synced_at,
        # A restored Pokémon is listed again.
        "removed_at": None,
    }
