import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.pokemon.models import Pokemon
from app.sync.enums import ChangeKind, SyncStatus
from app.sync.models import PokemonChange, SyncRun
from tests.support.sync import add_sync_run, make_sync_run


@pytest.fixture
def run(db_session: Session) -> SyncRun:
    """A stored sync run, for changes to belong to."""
    return add_sync_run(db_session)


def change(run: SyncRun, pokemon_id: int, kind: str) -> PokemonChange:
    """A change the run found, without snapshots."""
    return PokemonChange(
        pokemon_id=pokemon_id, sync_run_id=run.id, detected_at=run.finished_at, kind=kind
    )


def test_rejects_an_unknown_sync_status(db_session: Session) -> None:
    db_session.add(make_sync_run(status="exploded"))

    with pytest.raises(IntegrityError, match="ck_sync_runs_known_status"):
        db_session.flush()


def test_rejects_an_unknown_change_kind(
    db_session: Session, run: SyncRun, gyarados: Pokemon
) -> None:
    db_session.add(change(run, gyarados.id, kind="renamed"))

    with pytest.raises(IntegrityError, match="ck_pokemon_changes_known_kind"):
        db_session.flush()


def test_a_change_must_belong_to_a_known_pokemon(db_session: Session, run: SyncRun) -> None:
    db_session.add(change(run, 99999, kind="removed"))

    with pytest.raises(IntegrityError, match="fk_pokemon_changes_pokemon_id_pokemon"):
        db_session.flush()


def test_reads_status_and_kind_back_as_enums(
    db_session: Session, run: SyncRun, gyarados: Pokemon
) -> None:
    db_session.add(change(run, gyarados.id, kind="removed"))
    db_session.flush()
    db_session.expire_all()

    stored_change = db_session.scalars(select(PokemonChange)).one()

    assert (run.status, stored_change.kind) == (SyncStatus.SUCCEEDED, ChangeKind.REMOVED)
    assert (type(run.status), type(stored_change.kind)) == (SyncStatus, ChangeKind)
