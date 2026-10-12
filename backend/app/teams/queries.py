"""Teams as anyone can see them, whoever owns them."""

import uuid
from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any

from sqlalchemy import (
    ColumnElement,
    Exists,
    Row,
    Select,
    SQLColumnExpression,
    Subquery,
    exists,
    func,
    or_,
    select,
    tuple_,
)
from sqlalchemy.orm import Session, aliased
from sqlalchemy.orm.util import AliasedClass

from app.accounts import models as accounts_models
from app.accounts.exceptions import UserNotFoundError
from app.accounts.queries import find_user, has_username
from app.pokemon import models as pokemon_models
from app.pokemon.queries import changed_recently, pokemon_from_columns
from app.pokemon.schemas import as_stored_name
from app.teams import models, schemas
from app.teams.enums import TeamSort
from app.teams.exceptions import TeamNotFoundError

# A team and its owner's username.
TeamWithOwner = Row[models.Team, str]


def list_teams(session: Session, query: schemas.TeamsQuery) -> schemas.TeamPage:
    """One page of everyone's teams that have a Pokémon, after the cursor's team. They are newest
    first, or by power, highest first, with the newest first among equals. A team's power is the
    sum of its members' base stats as they are when the page is read, and is 0 for a team with no
    members.

    With an owner, only the teams of the user with that username, whatever the case, including
    teams with no Pokémon unless types or `changed` need one; a username no one has gives an
    empty page. With a search, only the teams whose name, owner's username or a Pokémon's name
    contains it, whatever the case. As in the Pokédex, a Pokémon's name is searched for the words
    joined by hyphens: "mega x" finds charizard-mega-x. With types, only the teams with a Pokémon
    of each type, and with `changed`, only those with a Pokémon a sync changed in the last week. A
    cursor that no team has gives an empty page.
    """
    powers = _team_powers()
    statement = (
        _with_owners()
        # Postgres leaves this join out when the sort doesn't use powers.
        .outerjoin(powers, powers.c.team_id == models.Team.id)
        .order_by(*(key.desc() for key in _sort_keys(query.sort, models.Team, powers)))
    )
    if query.owner is None:
        statement = statement.where(exists().where(models.TeamMember.team_id == models.Team.id))
    else:
        statement = statement.where(has_username(query.owner))
    if query.q is not None:
        # Escaped, so a % or _ in the search matches itself rather than acting as a wildcard.
        # A Pokémon is matched in a subquery, so a team with several matches is listed once.
        # A Pokémon's name is searched as it's stored, with hyphens; the others as typed.
        statement = statement.where(
            or_(
                models.Team.name.icontains(query.q, autoescape=True),
                accounts_models.User.username.icontains(query.q, autoescape=True),
                _has_a_pokemon(
                    pokemon_models.Pokemon.name.icontains(as_stored_name(query.q), autoescape=True)
                ),
            )
        )
    # A subquery for each type, so the types can be on different Pokémon.
    for type_ in query.types:
        statement = statement.where(
            _has_a_pokemon(pokemon_models.Pokemon.types.contains([type_.value]))
        )
    if query.changed:
        statement = statement.where(_has_a_pokemon(changed_recently()))
    if query.cursor is not None:
        # A row subquery of the cursor team's sort columns. Newest first, Postgres can start
        # scanning the (created_at, id) index at the cursor's team. A cursor that no team has
        # makes it null, which no row is less than.
        cursor_team = aliased(models.Team)
        cursor_powers = _team_powers()
        cursor = (
            select(*_sort_keys(query.sort, cursor_team, cursor_powers))
            .select_from(cursor_team)
            .outerjoin(cursor_powers, cursor_powers.c.team_id == cursor_team.id)
            .where(cursor_team.id == query.cursor)
            .scalar_subquery()
        )
        statement = statement.where(tuple_(*_sort_keys(query.sort, models.Team, powers)) < cursor)
    # One extra row shows whether another page follows, without counting the rest.
    teams = session.execute(statement.limit(query.limit + 1)).all()

    items = _shown(session, teams[: query.limit])
    next_cursor = items[-1].id if len(teams) > query.limit else None
    return schemas.TeamPage(items=items, next_cursor=next_cursor)


def list_user_teams(session: Session, username: str) -> list[schemas.Team]:
    """The user's teams, most recently changed first, including teams with no Pokémon.

    Raises UserNotFoundError if no user has the username, whatever its case.
    """
    user = find_user(session, username)
    if user is None:
        raise UserNotFoundError(username)
    teams = session.execute(
        _with_owners()
        .where(models.Team.user_id == user.id)
        .order_by(models.Team.updated_at.desc(), models.Team.created_at.desc())
    ).all()
    return _shown(session, teams)


def get_team(session: Session, team_id: uuid.UUID) -> schemas.Team:
    """A team, whoever owns it. Raises TeamNotFoundError if no team has this id."""
    team = session.execute(_with_owners().where(models.Team.id == team_id)).one_or_none()
    if team is None:
        raise TeamNotFoundError(team_id)
    (shown,) = _shown(session, [team])
    return shown


def _sort_keys(
    sort: TeamSort, team: type[models.Team] | AliasedClass[models.Team], powers: Subquery
) -> tuple[SQLColumnExpression[Any], ...]:
    """The columns the teams are ordered by, most significant first, each descending. The last is
    the team's id, so no two teams tie. `powers` is _team_powers joined to the team.
    """
    match sort:
        case TeamSort.NEWEST:
            return (team.created_at, team.id)
        case TeamSort.POWER:
            return (func.coalesce(powers.c.power, 0), team.created_at, team.id)


def _team_powers() -> Subquery:
    """Each team that has members, as (team_id, power): the sum of its members' base stats,
    removed Pokémon included, worked out from the stats as they are now.
    """
    pokemon = pokemon_models.Pokemon
    stats = (
        pokemon.hp
        + pokemon.attack
        + pokemon.defense
        + pokemon.sp_attack
        + pokemon.sp_defense
        + pokemon.speed
    )
    return (
        select(models.TeamMember.team_id, func.sum(stats).label("power"))
        .select_from(models.TeamMember)
        .join(pokemon, pokemon.id == models.TeamMember.pokemon_id)
        .group_by(models.TeamMember.team_id)
        .subquery()
    )


def _has_a_pokemon(condition: ColumnElement[bool]) -> Exists:
    """Whether the team has a Pokémon that meets the condition."""
    return exists().where(
        models.TeamMember.team_id == models.Team.id,
        models.TeamMember.pokemon_id == pokemon_models.Pokemon.id,
        condition,
    )


def _with_owners() -> Select[models.Team, str]:
    """Teams, each with its owner's username."""
    return select(models.Team, accounts_models.User.username).join(
        accounts_models.User, accounts_models.User.id == models.Team.user_id
    )


def _shown(session: Session, teams: Sequence[TeamWithOwner]) -> list[schemas.Team]:
    """The teams as the API shows them, each with its owner and its members in slot order."""
    rows = (
        session.execute(
            select(
                models.TeamMember.team_id,
                models.TeamMember.position,
                pokemon_models.Pokemon.__table__,
                models.TeamMember.species_id,
                models.TeamMember.family_id,
            )
            .join(pokemon_models.Pokemon, pokemon_models.Pokemon.id == models.TeamMember.pokemon_id)
            .where(models.TeamMember.team_id.in_([team.id for team, _ in teams]))
            .order_by(models.TeamMember.position)
        )
        .mappings()
        .all()
    )
    by_team: defaultdict[uuid.UUID, list[Mapping[Any, Any]]] = defaultdict(list)
    for row in rows:
        by_team[row["team_id"]].append(row)
    return [
        schemas.Team(
            id=team.id,
            name=team.name,
            owner=schemas.TeamOwner(username=username),
            created_at=team.created_at,
            updated_at=team.updated_at,
            members=_members_shown(by_team[team.id]),
        )
        for team, username in teams
    ]


def _members_shown(rows: Sequence[Mapping[Any, Any]]) -> list[schemas.TeamMember]:
    """Members as the API shows them, from rows of a position, the pokemon table's columns, a
    species_id and a family_id.
    """
    return [
        schemas.TeamMember(
            position=row["position"],
            pokemon=pokemon_from_columns(row),
            removed_at=row["removed_at"],
        )
        for row in rows
    ]
