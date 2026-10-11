"""Counter teams, and the threats to a team, worked out on request from the Pokédex and the
type chart (see scoring and search).

Nothing here writes to the database.
"""

from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.counter import queries, schemas, search
from app.counter.constants import MAX_THREATS
from app.counter.exceptions import (
    TooFewCandidatesError,
    TypeChartMissingError,
    UnknownPokemonError,
)
from app.counter.scoring import matchup, weak_to
from app.counter.types import Attack, Contender, Matchup


def find_counter_team(
    session: Session, query: schemas.TeamMatchupQuery
) -> list[schemas.Challenger]:
    """A team as big as the one given that matches up well against it (see search.counter_team),
    in battle order, each with its matchup against each of the team's Pokémon.

    Raises UnknownPokemonError if no Pokémon has one of the ids, TypeChartMissingError if no
    sync has stored the type chart, and TooFewCandidatesError if there are fewer evolution
    families to choose from than the team has Pokémon.
    """
    contenders = _contenders(session, query)
    size = len(query.pokemon_ids)
    if len({contender.candidate.family_id for contender in contenders}) < size:
        raise TooFewCandidatesError
    return _challengers(session, search.counter_team(contenders, size), query.pokemon_ids)


def list_team_threats(
    session: Session, query: schemas.TeamMatchupQuery
) -> list[schemas.Challenger]:
    """Up to MAX_THREATS Pokémon that match up best against the team (see search.threats),
    each with its matchup against each of the team's Pokémon.

    Raises UnknownPokemonError and TypeChartMissingError as find_counter_team does.
    """
    threats = search.threats(_contenders(session, query), MAX_THREATS)
    return _challengers(session, threats, query.pokemon_ids)


def _contenders(session: Session, query: schemas.TeamMatchupQuery) -> list[Contender]:
    """Every Pokémon the query lets us choose from, scored against each of the team's Pokémon.
    The team's Pokémon are scored as stored, even if PokéAPI no longer lists them.
    """
    found = queries.profiles(session, query.pokemon_ids)
    if any(pokemon_id not in found for pokemon_id in query.pokemon_ids):
        raise UnknownPokemonError
    chart = queries.type_chart(session)
    if not chart:
        raise TypeChartMissingError
    team = [found[pokemon_id] for pokemon_id in query.pokemon_ids]
    attacking = {type_ for member in team for type_ in member.types}
    return [
        Contender(
            candidate,
            tuple(matchup(candidate.profile, opponent, chart) for opponent in team),
            weak_to(candidate.profile, attacking, chart),
        )
        for candidate in queries.candidates(
            session, forms=query.forms, legendaries=query.legendaries
        )
    ]


def _challengers(
    session: Session, contenders: Sequence[Contender], team_ids: Sequence[int]
) -> list[schemas.Challenger]:
    """The contenders as the API shows them, in the order given."""
    pokemon = queries.pokemon(session, [each.candidate.profile.id for each in contenders])
    return [
        schemas.Challenger(
            pokemon=pokemon[contender.candidate.profile.id],
            matchups=[
                _matchup(opponent_id, each)
                for opponent_id, each in zip(team_ids, contender.matchups, strict=True)
            ],
        )
        for contender in contenders
    ]


def _matchup(opponent_id: int, scored: Matchup) -> schemas.Matchup:
    return schemas.Matchup(
        opponent_id=opponent_id,
        attack=_attack(scored.attack),
        opponent_attack=_attack(scored.opponent_attack),
        speed=scored.speed,
        stat_total_difference=scored.stat_total_difference,
        score=scored.score,
        rating=scored.rating,
    )


def _attack(attack: Attack) -> schemas.Attack:
    return schemas.Attack(type=attack.type, multiplier=attack.multiplier)
