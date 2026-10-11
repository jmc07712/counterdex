"""Counter teams, worked out on request from the Pokédex and the type chart (see battle and
search).

Nothing here writes to the database.
"""

from collections.abc import Sequence

from sqlalchemy.orm import Session

from app.counter import queries, schemas, search
from app.counter.battle import exchange
from app.counter.exceptions import (
    TooFewCandidatesError,
    TypeChartMissingError,
    UnknownPokemonError,
)
from app.counter.types import Contender, Exchange, Hit


def find_counter_team(
    session: Session, query: schemas.TeamMatchupQuery
) -> list[schemas.Challenger]:
    """A team as big as the one given that beats it (see search.counter_team), in battle order,
    each with how it fares against each of the team's Pokémon.

    Raises UnknownPokemonError if no Pokémon has one of the ids, TypeChartMissingError if no
    sync has stored the type chart, and TooFewCandidatesError if there are fewer evolution
    families to choose from than the team has Pokémon.
    """
    contenders = _contenders(session, query)
    size = len(query.pokemon_ids)
    if len({contender.candidate.family_id for contender in contenders}) < size:
        raise TooFewCandidatesError
    return _challengers(session, search.counter_team(contenders, size), query.pokemon_ids)


def _contenders(session: Session, query: schemas.TeamMatchupQuery) -> list[Contender]:
    """Every Pokémon the query lets us choose from, with its exchange with each of the team's
    Pokémon. The team's Pokémon are matched as stored, even if PokéAPI no longer lists them.
    """
    found = queries.fighters(session, query.pokemon_ids)
    if any(pokemon_id not in found for pokemon_id in query.pokemon_ids):
        raise UnknownPokemonError
    chart = queries.type_chart(session)
    if not chart:
        raise TypeChartMissingError
    team = [found[pokemon_id] for pokemon_id in query.pokemon_ids]
    return [
        Contender(
            candidate,
            tuple(exchange(candidate.fighter, opponent, chart) for opponent in team),
        )
        for candidate in queries.candidates(
            session, forms=query.forms, legendaries=query.legendaries
        )
    ]


def _challengers(
    session: Session, contenders: Sequence[Contender], team_ids: Sequence[int]
) -> list[schemas.Challenger]:
    """The contenders as the API shows them, in the order given."""
    pokemon = queries.pokemon(session, [each.candidate.fighter.id for each in contenders])
    return [
        schemas.Challenger(
            pokemon=pokemon[contender.candidate.fighter.id],
            matchups=[
                _matchup(opponent_id, each)
                for opponent_id, each in zip(team_ids, contender.exchanges, strict=True)
            ],
        )
        for contender in contenders
    ]


def _matchup(opponent_id: int, result: Exchange) -> schemas.Matchup:
    return schemas.Matchup(
        opponent_id=opponent_id,
        verdict=result.verdict,
        hp_left=result.hp_left,
        speed=result.speed,
        attack=_attack(result.hit),
        opponent_attack=_attack(result.opponent_hit),
    )


def _attack(hit: Hit) -> schemas.Attack:
    return schemas.Attack(type=hit.type, multiplier=hit.multiplier, hits=hit.hits)
