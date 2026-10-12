"""Counter teams, the threats to a team, and one team scored against another, worked out on
request from the Pokédex and the type chart (see scoring and search).

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
from app.counter.types import Attack, Contender, Matchup, Profile, TypeChart
from app.pokemon.schemas import Pokemon


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
    each with its matchup against each of the team's Pokémon. None is from the evolution family
    of one of the team's Pokémon, listed or not.

    Raises UnknownPokemonError and TypeChartMissingError as find_counter_team does.
    """
    contenders = _contenders(session, query)
    families = {each.family_id for each in queries.pokemon(session, query.pokemon_ids).values()}
    others = [each for each in contenders if each.candidate.family_id not in families]
    threats = search.threats(others, MAX_THREATS)
    return _challengers(session, threats, query.pokemon_ids)


def score_teams(session: Session, query: schemas.MatchupsQuery) -> schemas.TeamMatchups:
    """Our team scored against theirs: each of ours against each of theirs, in the orders given.
    Pokémon that PokéAPI no longer lists are scored as stored.

    Raises UnknownPokemonError if no Pokémon has one of the ids, and TypeChartMissingError if no
    sync has stored the type chart.
    """
    ours = _profiles(session, query.pokemon_ids)
    theirs = _profiles(session, query.opponent_ids)
    chart = _type_chart(session)
    team = [[matchup(member, opponent, chart) for opponent in theirs] for member in ours]
    pokemon = queries.pokemon(session, query.pokemon_ids)
    return schemas.TeamMatchups(
        members=[
            _challenger(pokemon[pokemon_id], query.opponent_ids, row)
            for pokemon_id, row in zip(query.pokemon_ids, team, strict=True)
        ],
    )


def _profiles(session: Session, pokemon_ids: Sequence[int]) -> list[Profile]:
    """These Pokémon as scoring sees them, listed or not, in the order given. Raises
    UnknownPokemonError if no Pokémon has one of the ids.
    """
    found = queries.profiles(session, pokemon_ids)
    if any(pokemon_id not in found for pokemon_id in pokemon_ids):
        raise UnknownPokemonError
    return [found[pokemon_id] for pokemon_id in pokemon_ids]


def _type_chart(session: Session) -> TypeChart:
    """The stored type chart. Raises TypeChartMissingError if no sync has stored it."""
    chart = queries.type_chart(session)
    if not chart:
        raise TypeChartMissingError
    return chart


def _contenders(session: Session, query: schemas.TeamMatchupQuery) -> list[Contender]:
    """Every Pokémon the query lets us choose from, scored against each of the team's Pokémon.
    The team's Pokémon are scored as stored, even if PokéAPI no longer lists them.
    """
    team = _profiles(session, query.pokemon_ids)
    chart = _type_chart(session)
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
        _challenger(pokemon[contender.candidate.profile.id], team_ids, contender.matchups)
        for contender in contenders
    ]


def _challenger(
    pokemon: Pokemon, opponent_ids: Sequence[int], matchups: Sequence[Matchup]
) -> schemas.Challenger:
    """A Pokémon and its matchups, as the API shows them, against the opponents with these ids
    in the same order.
    """
    return schemas.Challenger(
        pokemon=pokemon,
        matchups=[
            _matchup(opponent_id, scored)
            for opponent_id, scored in zip(opponent_ids, matchups, strict=True)
        ],
    )


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
