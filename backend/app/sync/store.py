"""Write a sync's Pokémon and species to the database, and work out which Pokémon changed."""

from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import RowMapping, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.db import Base
from app.pokemon import models, schemas
from app.sync.constants import MAX_REMOVED_SHARE, MIN_REMOVALS_ALLOWED
from app.sync.enums import ChangeKind
from app.sync.exceptions import SuspiciousRemovalError
from app.sync.normalize import content_hash
from app.sync.types import Change, SpeciesRecord, StoreResult


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
            changes.append(
                Change(fetched.id, ChangeKind.RESTORED, _row_snapshot(row), _snapshot(fetched))
            )
            to_write.append(fetched)
        elif row["content_hash"] != content_hash(fetched):
            updated += 1
            changes.append(
                Change(fetched.id, ChangeKind.UPDATED, _row_snapshot(row), _snapshot(fetched))
            )
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
        Change(pokemon_id, ChangeKind.REMOVED, _row_snapshot(current[pokemon_id]), None)
        for pokemon_id in removed_ids
    )

    if to_write:
        _upsert(session, models.Pokemon, [_row(each, synced_at) for each in to_write])
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


def store_species(session: Session, species: Sequence[SpeciesRecord]) -> None:
    """Bring the species tables in line with PokéAPI.

    Species are reference data, so they're overwritten and their changes aren't recorded. A
    Pokémon that isn't stored (it failed to sync) joins its species when a later sync stores it.
    """
    if not species:
        return
    _upsert(
        session,
        models.Species,
        [
            {
                "id": each.id,
                "name": each.name,
                "genus": each.genus,
                "evolution_chain_id": each.evolution_chain_id,
                "evolves_from_species_id": each.evolves_from_species_id,
                # Only the conditions that apply; the rest read back as their defaults.
                "evolution_methods": [
                    method.model_dump(mode="json", exclude_defaults=True)
                    for method in each.evolution_methods
                ],
            }
            for each in species
        ],
    )
    stored_pokemon = set(session.scalars(select(models.Pokemon.id)))
    varieties = [
        {"pokemon_id": pokemon_id, "species_id": each.id}
        for each in species
        for pokemon_id in each.pokemon_ids
        if pokemon_id in stored_pokemon
    ]
    if varieties:
        _upsert(session, models.SpeciesVariety, varieties)


def _upsert(session: Session, model: type[Base], rows: list[dict[str, Any]]) -> None:
    """Insert the rows, overwriting any stored row with the same primary key."""
    table = model.__table__
    key = [column.name for column in table.primary_key]
    statement = insert(model).values(rows)
    session.execute(
        statement.on_conflict_do_update(
            index_elements=key,
            set_={
                column.name: statement.excluded[column.name]
                for column in table.columns
                if column.name not in key
            },
        )
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
