"""The counter teams picked for real teams from a small Pokédex of real Pokémon. A change to the
scoring or its weights shows up here as a different team.
"""

import pytest
from sqlalchemy.orm import Session

from app.counter.schemas import TeamMatchupQuery
from app.counter.service import find_counter_team

KANTO_SIX = [6, 3, 9, 25, 143, 94]
# Garchomp, Tyranitar, Scizor, Rotom-Wash, Dragonite and Gholdengo.
OU_TEAM = [445, 248, 212, 10009, 149, 1000]


def picks(session: Session, team: list[int], *, legendaries: bool = False) -> list[str]:
    """The counter team's names, in battle order."""
    query = TeamMatchupQuery(pokemon_ids=team, legendaries=legendaries)
    return [member.pokemon.name for member in find_counter_team(session, query)]


@pytest.mark.usefixtures("pokedex")
@pytest.mark.parametrize(
    ("team", "expected"),
    [
        pytest.param([6, 9, 3], ["aerodactyl", "kingdra", "skarmory"], id="kanto-starters"),
        pytest.param(
            [887, 445, 94], ["jigglypuff", "togekiss", "kingambit"], id="dragapult-garchomp-gengar"
        ),
        pytest.param(
            KANTO_SIX,
            ["tyranitar", "skarmory", "kingdra", "garchomp", "golem", "dragapult"],
            id="kanto-six",
        ),
    ],
)
def test_picks_the_same_counter_team_for_a_real_team(
    db_session: Session, team: list[int], expected: list[str]
) -> None:
    assert picks(db_session, team) == expected


@pytest.mark.usefixtures("pokedex")
def test_picks_togekiss_over_its_weaker_relative_togetic(db_session: Session) -> None:
    # One family, and the same types, immune to Dragon and Ground; Togekiss has the higher base
    # stat total, so it scores higher.
    team = picks(db_session, OU_TEAM, legendaries=True)

    assert "togekiss" in team
    assert "togetic" not in team
