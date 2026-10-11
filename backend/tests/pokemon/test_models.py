from typing import Any

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.pokemon.models import TypeMatchup
from tests.support.pokemon import make_pokemon


def test_sprite_is_optional(db_session: Session) -> None:
    db_session.add(make_pokemon(sprite_url=None))
    db_session.flush()


@pytest.mark.parametrize(
    ("columns", "constraint"),
    [
        pytest.param({"types": []}, "ck_pokemon_one_or_two_types", id="no-types"),
        pytest.param(
            {"types": ["fire", "flying", "dragon"]}, "ck_pokemon_one_or_two_types", id="three-types"
        ),
        pytest.param({"types": ["water", "shadow"]}, "ck_pokemon_known_types", id="unknown-type"),
        pytest.param({"hp": 0}, "ck_pokemon_hp_in_range", id="base-stat-below-1"),
        pytest.param({"hp": 256}, "ck_pokemon_hp_in_range", id="base-stat-above-255"),
    ],
)
def test_rejects_a_pokemon_with_impossible_types_or_stats(
    db_session: Session, columns: dict[str, Any], constraint: str
) -> None:
    db_session.add(make_pokemon(**columns))

    with pytest.raises(IntegrityError, match=constraint):
        db_session.flush()


def test_names_are_unique(db_session: Session) -> None:
    db_session.add(make_pokemon(id=25))
    db_session.flush()
    db_session.add(make_pokemon(id=10080))

    with pytest.raises(IntegrityError, match="uq_pokemon_name"):
        db_session.flush()


@pytest.mark.parametrize(
    ("columns", "constraint"),
    [
        pytest.param(
            {"attacking_type": "shadow"},
            "ck_type_matchups_known_attacking_type",
            id="unknown-attacking-type",
        ),
        pytest.param(
            {"defending_type": "stellar"},
            "ck_type_matchups_known_defending_type",
            id="unknown-defending-type",
        ),
        pytest.param({"multiplier": 4}, "ck_type_matchups_known_multiplier", id="four-times"),
        pytest.param({"multiplier": 0.25}, "ck_type_matchups_known_multiplier", id="quarter"),
    ],
)
def test_rejects_a_type_matchup_with_an_unknown_type_or_multiplier(
    db_session: Session, columns: dict[str, Any], constraint: str
) -> None:
    matchup = {"attacking_type": "water", "defending_type": "fire", "multiplier": 2} | columns
    db_session.add(TypeMatchup(**matchup))

    with pytest.raises(IntegrityError, match=constraint):
        db_session.flush()
