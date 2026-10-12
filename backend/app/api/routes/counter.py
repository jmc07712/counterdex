from collections.abc import Iterator
from contextlib import contextmanager
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.api.caching import cache_publicly
from app.api.constants import COUNTER_TEAM_CACHE_CONTROL
from app.api.dependencies import SessionDep
from app.api.tags import COUNTER_TEAM
from app.counter import service
from app.counter.exceptions import (
    TooFewCandidatesError,
    TypeChartMissingError,
    UnknownPokemonError,
)
from app.counter.schemas import Challenger, MatchupsQuery, TeamMatchupQuery, TeamMatchups

router = APIRouter(tags=[COUNTER_TEAM])

UNKNOWN_POKEMON = "No Pokémon has one or more of these ids."
TYPE_CHART_MISSING = (
    "The type chart hasn't been synced from PokéAPI yet, so no matchup can be worked out. Run a "
    "sync first."
)
TOO_FEW_CANDIDATES = "Too few Pokémon have been synced to choose a team from. Run a sync first."
NOT_SYNCED: dict[int | str, dict[str, Any]] = {
    status.HTTP_503_SERVICE_UNAVAILABLE: {
        "description": "The Pokédex hasn't been synced enough to answer: run a sync first."
    }
}


@contextmanager
def counter_errors() -> Iterator[None]:
    """Turns the counter service's errors into the HTTP errors the routes document."""
    try:
        yield
    except UnknownPokemonError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, UNKNOWN_POKEMON) from None
    except TypeChartMissingError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, TYPE_CHART_MISSING) from None
    except TooFewCandidatesError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, TOO_FEW_CANDIDATES) from None


@router.get("/counter-team", summary="Find a counter team", responses=NOT_SYNCED)
def find_counter_team(
    session: SessionDep, response: Response, query: Annotated[TeamMatchupQuery, Query()]
) -> list[Challenger]:
    """A team as big as the given one that matches up well against it, for a saved team or a
    guest's draft.

    Each of our Pokémon is scored against each of theirs from types and base stats alone: how
    effective its best type is against theirs, how effective their best type is against it,
    which has the higher base stat total, and which is faster. Types count in whole points, and
    stats a quarter point for each 100 of base stat total between them and a quarter point for
    Speed, so a big enough gap in stats can outweigh a type: each matchup's `score` says how.
    Each matchup is rated `good`, `even` or `bad`.

    The team is chosen one Pokémon at a time, each the one that most raises our best scores
    against theirs, with a penalty for three or more of ours being weak to one of their types.
    It has one Pokémon from each evolution family, so it can be saved as a team. It comes in
    battle order: our lead scores best against their lead, and the rest follow the order of the
    Pokémon they score best against.

    Alternate forms, and legendary and mythical Pokémon, are left out unless asked for. Their
    team may have Pokémon that PokéAPI no longer lists; ours never does. An `id` given twice,
    or with no Pokémon, is a 422.
    """
    with counter_errors():
        team = service.find_counter_team(session, query)
    cache_publicly(response, COUNTER_TEAM_CACHE_CONTROL)
    return team


@router.get("/team-threats", summary="List the threats to a team", responses=NOT_SYNCED)
def list_team_threats(
    session: SessionDep, response: Response, query: Annotated[TeamMatchupQuery, Query()]
) -> list[Challenger]:
    """Up to 12 Pokémon that match up best against a team, scored as in Find a counter team,
    each with its matchup against each of the team's Pokémon. The highest total score comes
    first, and each evolution family appears once, by its best. Pokémon from the team's own
    evolution families are left out, including the family of one of its Pokémon that PokéAPI no
    longer lists. Each matchup is scored from the threat's side, so a threat's `good` rating is
    good for the threat and bad for the team.

    Alternate forms, and legendary and mythical Pokémon, are left out unless asked for. An `id`
    given twice, or with no Pokémon, is a 422.
    """
    with counter_errors():
        threats = service.list_team_threats(session, query)
    cache_publicly(response, COUNTER_TEAM_CACHE_CONTROL)
    return threats


@router.get("/matchups", summary="Score a team against another", responses=NOT_SYNCED)
def score_teams(
    session: SessionDep, response: Response, query: Annotated[MatchupsQuery, Query()]
) -> TeamMatchups:
    """Our team scored against theirs, the way Find a counter team scores its picks: each of our
    Pokémon against each of theirs, in the orders given. For a team being edited against the team
    it's meant to counter.

    Either team may have Pokémon that PokéAPI no longer lists. An `id` given twice on one team,
    or with no Pokémon, is a 422. The same Pokémon may be on both teams.
    """
    with counter_errors():
        scored = service.score_teams(session, query)
    cache_publicly(response, COUNTER_TEAM_CACHE_CONTROL)
    return scored
