from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from app.sync.enums import ChangeKind, SyncStatus
from app.sync.queries import get_sync_overview, list_pokemon_changes
from tests.support.pokemon import GYARADOS_CDN_SPRITE, add_pokemon
from tests.support.sync import add_change, add_sync_run, gyarados_snapshot

MORNING = datetime(2026, 10, 10, 9, tzinfo=UTC)
NEXT_MORNING = MORNING + timedelta(days=1)


def test_reports_nothing_before_the_first_sync(db_session: Session) -> None:
    overview = get_sync_overview(db_session)

    assert (overview.last_synced_at, overview.latest_run) == (None, None)


def test_reports_the_latest_sync(db_session: Session) -> None:
    add_sync_run(db_session, finished_at=MORNING)
    add_sync_run(db_session, finished_at=NEXT_MORNING)

    overview = get_sync_overview(db_session)

    assert overview.last_synced_at == NEXT_MORNING
    assert overview.latest_run is not None
    assert overview.latest_run.finished_at == NEXT_MORNING


def test_a_failed_sync_does_not_hide_when_the_data_was_last_fresh(db_session: Session) -> None:
    add_sync_run(db_session, finished_at=MORNING)
    add_sync_run(db_session, finished_at=NEXT_MORNING, status=SyncStatus.FAILED)

    overview = get_sync_overview(db_session)

    assert overview.last_synced_at == MORNING
    assert overview.latest_run is not None
    assert overview.latest_run.status is SyncStatus.FAILED


# --- A Pokémon's changes ---


@pytest.fixture
def gyarados_changes(db_session: Session, gyarados: None) -> None:
    """Gyarados sped up one morning and removed the next, and another Pokémon's change."""
    add_change(
        db_session,
        130,
        ChangeKind.UPDATED,
        before=gyarados_snapshot(),
        after=gyarados_snapshot(speed=90),
        detected_at=MORNING,
    )
    add_change(
        db_session,
        130,
        ChangeKind.REMOVED,
        before=gyarados_snapshot(speed=90),
        after=None,
        detected_at=NEXT_MORNING,
    )
    add_pokemon(db_session, 25)
    add_change(
        db_session,
        25,
        ChangeKind.REMOVED,
        before=gyarados_snapshot(name="pokemon-25"),
        after=None,
        detected_at=NEXT_MORNING,
    )


@pytest.mark.usefixtures("gyarados_changes")
def test_lists_a_pokemons_changes_newest_first(db_session: Session) -> None:
    changes = list_pokemon_changes(db_session, 130)

    assert [(change.kind, change.detected_at) for change in changes] == [
        (ChangeKind.REMOVED, NEXT_MORNING),
        (ChangeKind.UPDATED, MORNING),
    ]


@pytest.mark.usefixtures("gyarados_changes")
def test_reads_each_snapshot_as_the_pokemon_it_was(db_session: Session) -> None:
    removal, update = list_pokemon_changes(db_session, 130)

    assert update.before is not None
    assert update.after is not None
    assert (update.before.stats.speed, update.after.stats.speed) == (81, 90)
    assert (update.before.id, update.before.sprite_url) == (130, GYARADOS_CDN_SPRITE)
    assert removal.after is None
