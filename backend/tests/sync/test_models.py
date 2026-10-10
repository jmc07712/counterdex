from datetime import UTC, datetime
from typing import Any

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.pokemon.models import Pokemon
from app.sync.models import PokemonChange, SyncRun
from tests.support.pokemon import make_pokemon

STARTED = datetime(2026, 10, 10, 9, tzinfo=UTC)


def make_run(**overrides: Any) -> SyncRun:
    fields: dict[str, Any] = {
        "started_at": STARTED,
        "finished_at": STARTED,
        "status": "succeeded",
        "fetched": 1351,
        "inserted": 0,
        "updated": 1,
        "unchanged": 1350,
        "removed": 0,
        "restored": 0,
        "failed": [],
    }
    return SyncRun(**(fields | overrides))


def test_stores_a_sync_run_with_its_failures(db_session: Session) -> None:
    run = make_run(status="failed", failed=["https://pokeapi.co/api/v2/pokemon/6/"], error="boom")
    db_session.add(run)
    db_session.flush()
    db_session.expire_all()

    assert db_session.get(SyncRun, run.id) == run
    assert run.failed == ["https://pokeapi.co/api/v2/pokemon/6/"]


def test_rejects_an_unknown_sync_status(db_session: Session) -> None:
    db_session.add(make_run(status="exploded"))

    with pytest.raises(IntegrityError, match="ck_sync_runs_known_status"):
        db_session.flush()


def test_stores_a_change_with_its_before_and_after_snapshots(db_session: Session) -> None:
    run = make_run()
    pokemon = make_pokemon()
    db_session.add_all([pokemon, run])
    db_session.flush()
    change = PokemonChange(
        pokemon_id=pokemon.id,
        sync_run_id=run.id,
        detected_at=STARTED,
        kind="updated",
        before={"speed": 90},
        after={"speed": 150},
    )
    db_session.add(change)
    db_session.flush()
    db_session.expire_all()

    loaded = db_session.get(PokemonChange, change.id)

    assert loaded is not None
    assert (loaded.kind, loaded.before, loaded.after) == ("updated", {"speed": 90}, {"speed": 150})


def test_rejects_an_unknown_change_kind(db_session: Session) -> None:
    run = make_run()
    pokemon = make_pokemon()
    db_session.add_all([pokemon, run])
    db_session.flush()
    db_session.add(
        PokemonChange(
            pokemon_id=pokemon.id,
            sync_run_id=run.id,
            detected_at=STARTED,
            kind="renamed",
            before=None,
        )
    )

    with pytest.raises(IntegrityError, match="ck_pokemon_changes_known_kind"):
        db_session.flush()


def test_a_change_must_belong_to_a_known_pokemon(db_session: Session) -> None:
    run = make_run()
    db_session.add(run)
    db_session.flush()
    db_session.add(
        PokemonChange(pokemon_id=99999, sync_run_id=run.id, detected_at=STARTED, kind="removed")
    )

    with pytest.raises(IntegrityError, match="fk_pokemon_changes_pokemon_id_pokemon"):
        db_session.flush()


def test_pokemon_are_not_removed_by_default(db_session: Session) -> None:
    pokemon = make_pokemon()
    db_session.add(pokemon)
    db_session.flush()

    loaded = db_session.get(Pokemon, pokemon.id)

    assert loaded is not None
    assert loaded.removed_at is None
