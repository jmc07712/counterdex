"""Teams and the Pokémon on them.

Anyone can see a team; only its owner can change it. Every change takes a team that lock_owned_team
has locked, so changes to one team happen one at a time and each sees the result of the one before.
Nothing here commits: the caller owns the transaction.
"""

import uuid
from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any

from psycopg.errors import UniqueViolation
from sqlalchemy import (
    Insert,
    Row,
    Select,
    Update,
    delete,
    exists,
    func,
    insert,
    select,
    text,
    tuple_,
    update,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from app.accounts import models as accounts_models
from app.pokemon import models as pokemon_models
from app.pokemon.queries import pokemon_from_columns
from app.teams import models, schemas
from app.teams.constants import MAX_TEAM_SIZE
from app.teams.enums import TeamConflictReason
from app.teams.exceptions import (
    MemberNotFoundError,
    NotTeamOwnerError,
    TeamConflictError,
    TeamNotFoundError,
    UnknownPokemonError,
    UserNotFoundError,
)

FAMILY_ON_TEAM = "uq_team_members_team_id_family_id"
TEAM_ID = "pk_teams"
SLOT = "uq_team_members_team_id_position"

# A member's row: id, position, pokemon_id and family_id.
Member = Row[int, int, int, int]
# A team and its owner's username.
TeamWithOwner = Row[models.Team, str]


def list_teams(session: Session, query: schemas.TeamsQuery) -> schemas.TeamPage:
    """One page of everyone's teams that have a Pokémon, newest first, after the cursor's team.

    A cursor that no team has gives an empty page.
    """
    statement = (
        _with_owners()
        .where(exists().where(models.TeamMember.team_id == models.Team.id))
        .order_by(models.Team.created_at.desc(), models.Team.id.desc())
    )
    if query.cursor is not None:
        # A row subquery, so Postgres can start scanning the (created_at, id) index at the
        # cursor's team. A cursor that no team has makes it null, which no row is less than.
        cursor_team = aliased(models.Team)
        cursor = (
            select(cursor_team.created_at, cursor_team.id)
            .where(cursor_team.id == query.cursor)
            .scalar_subquery()
        )
        statement = statement.where(tuple_(models.Team.created_at, models.Team.id) < cursor)
    # One extra row shows whether another page follows, without counting the rest.
    teams = session.execute(statement.limit(query.limit + 1)).all()

    items = _shown(session, teams[: query.limit])
    next_cursor = items[-1].id if len(teams) > query.limit else None
    return schemas.TeamPage(items=items, next_cursor=next_cursor)


def list_user_teams(session: Session, username: str) -> list[schemas.Team]:
    """The user's teams, most recently changed first, including teams with no Pokémon.

    Raises UserNotFoundError if no user has the username, whatever its case.
    """
    user_id = session.scalar(
        select(accounts_models.User.id).where(
            func.lower(accounts_models.User.username) == username.lower()
        )
    )
    if user_id is None:
        raise UserNotFoundError(username)
    teams = session.execute(
        _with_owners()
        .where(models.Team.user_id == user_id)
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


def preview(session: Session, pokemon_ids: Sequence[int]) -> list[schemas.TeamMember]:
    """These Pokémon as a team's members would be, in the order given, for a team that isn't
    saved, such as a guest's. Ids with no Pokémon, or whose species isn't stored yet, are left
    out.
    """
    rows = (
        session.execute(
            select(
                pokemon_models.Pokemon.__table__,
                pokemon_models.SpeciesVariety.species_id,
                pokemon_models.Species.evolution_chain_id.label("family_id"),
            )
            .join(
                pokemon_models.SpeciesVariety,
                pokemon_models.SpeciesVariety.pokemon_id == pokemon_models.Pokemon.id,
            )
            .join(
                pokemon_models.Species,
                pokemon_models.Species.id == pokemon_models.SpeciesVariety.species_id,
            )
            .where(pokemon_models.Pokemon.id.in_(pokemon_ids))
        )
        .mappings()
        .all()
    )
    by_id = {row["id"]: row for row in rows}
    known = [pokemon_id for pokemon_id in pokemon_ids if pokemon_id in by_id]
    members = [
        {**by_id[pokemon_id], "position": position} for position, pokemon_id in enumerate(known)
    ]
    return _members_shown(members)


def create_team(
    session: Session, user_id: int, team_id: uuid.UUID, new: schemas.NewTeam
) -> tuple[schemas.Team, bool]:
    """Creates a team with the id the client chose, and returns it with True.

    If the user already has a team with this id, returns that team unchanged with False, so a
    create sent twice makes one team. Raises TeamConflictError (TEAM_ID_TAKEN) if another user
    has the id, and raises as _append does for each of the new team's Pokémon.
    """
    team = models.Team(id=team_id, user_id=user_id, name=new.name)
    try:
        # In a savepoint, so a taken id doesn't abort the caller's transaction.
        with session.begin_nested():
            session.add(team)
    except IntegrityError as error:
        if not _violates(error, TEAM_ID):
            raise
        owner = session.scalar(select(models.Team.user_id).where(models.Team.id == team_id))
        if owner != user_id:
            raise TeamConflictError(TeamConflictReason.TEAM_ID_TAKEN) from error
        return get_team(session, team_id), False
    for pokemon_id in new.pokemon_ids:
        _append(session, team_id, pokemon_id)
    return get_team(session, team_id), True


def lock_owned_team(session: Session, user_id: int, team_id: uuid.UUID) -> models.Team:
    """The user's team, its row locked until the transaction ends: other changes to the team
    wait for this one. Raises TeamNotFoundError if no team has this id, or NotTeamOwnerError if
    the team is someone else's.
    """
    team = session.scalars(
        select(models.Team)
        .where(models.Team.id == team_id)
        .with_for_update()
        # Reloaded, so the lock's read replaces anything the session read before it.
        .execution_options(populate_existing=True)
    ).one_or_none()
    if team is None:
        raise TeamNotFoundError(team_id)
    if team.user_id != user_id:
        raise NotTeamOwnerError(team_id)
    return team


def rename_team(session: Session, team: models.Team, name: str) -> schemas.Team:
    """Renames the team."""
    team.name = name
    return _changed(session, team)


def delete_team(session: Session, team: models.Team) -> None:
    """Deletes the team and its members."""
    session.delete(team)
    session.flush()


def add_member(session: Session, team: models.Team, pokemon_id: int) -> schemas.Team:
    """Puts a Pokémon in the team's next free slot.

    Raises UnknownPokemonError, or TeamConflictError: FAMILY_ON_TEAM if a Pokémon from its
    evolution family is on the team already, TEAM_FULL if the team has six members, or
    POKEMON_REMOVED if PokéAPI no longer lists the Pokémon.
    """
    _append(session, team.id, pokemon_id)
    return _changed(session, team)


def replace_member(
    session: Session, team: models.Team, pokemon_id: int, new_pokemon_id: int
) -> schemas.Team:
    """Puts another Pokémon in a member's slot, such as Charizard in Charmander's. If the new
    Pokémon is on the team already, it moves into the slot and the gap it leaves closes.

    Raises MemberNotFoundError if `pokemon_id` isn't on the team, and raises as add_member does,
    except that the team may be full and the new Pokémon may be from the replaced one's family.
    """
    members = _members(session, team.id)
    replaced = _find(members, pokemon_id)
    if replaced is None:
        raise MemberNotFoundError(pokemon_id)
    if new_pokemon_id != pokemon_id:
        species_id, family_id = _listed_species(session, new_pokemon_id)
        others = [m for m in members if m.pokemon_id not in {pokemon_id, new_pokemon_id}]
        if any(member.family_id == family_id for member in others):
            raise TeamConflictError(TeamConflictReason.FAMILY_ON_TEAM)
        moving = _find(members, new_pokemon_id)
        if moving is not None:
            _remove(session, team.id, moving)
        _guarded(
            session,
            update(models.TeamMember)
            .where(models.TeamMember.id == replaced.id)
            .values(pokemon_id=new_pokemon_id, species_id=species_id, family_id=family_id),
        )
        _check_slots(session)
    return _changed(session, team)


def remove_member(session: Session, team: models.Team, pokemon_id: int) -> schemas.Team:
    """Takes a Pokémon off the team; the members after it move up a slot.

    Raises MemberNotFoundError if the Pokémon isn't on the team.
    """
    removed = _find(_members(session, team.id), pokemon_id)
    if removed is None:
        raise MemberNotFoundError(pokemon_id)
    _remove(session, team.id, removed)
    _check_slots(session)
    return _changed(session, team)


def reorder(session: Session, team: models.Team, pokemon_ids: Sequence[int]) -> schemas.Team:
    """Puts the team's members in this order, given as every member's Pokémon id, each once.

    Raises TeamConflictError (ORDER_OUT_OF_DATE) if the ids aren't exactly the members, e.g.
    because a change made elsewhere came first.
    """
    members = {member.pokemon_id: member for member in _members(session, team.id)}
    if sorted(pokemon_ids) != sorted(members):
        raise TeamConflictError(TeamConflictReason.ORDER_OUT_OF_DATE)
    for position, pokemon_id in enumerate(pokemon_ids):
        session.execute(
            update(models.TeamMember)
            .where(models.TeamMember.id == members[pokemon_id].id)
            .values(position=position)
        )
    _check_slots(session)
    return _changed(session, team)


def _members(session: Session, team_id: uuid.UUID) -> Sequence[Member]:
    """The team's members, in slot order."""
    return session.execute(
        select(
            models.TeamMember.id,
            models.TeamMember.position,
            models.TeamMember.pokemon_id,
            models.TeamMember.family_id,
        )
        .where(models.TeamMember.team_id == team_id)
        .order_by(models.TeamMember.position)
    ).all()


def _append(session: Session, team_id: uuid.UUID, pokemon_id: int) -> None:
    """Puts a Pokémon in the team's next free slot.

    Raises as _listed_species does, and TeamConflictError with FAMILY_ON_TEAM if a Pokémon from
    its evolution family is on the team already, or TEAM_FULL if it has six members.
    """
    members = _members(session, team_id)
    species_id, family_id = _listed_species(session, pokemon_id)
    if any(member.family_id == family_id for member in members):
        raise TeamConflictError(TeamConflictReason.FAMILY_ON_TEAM)
    if len(members) >= MAX_TEAM_SIZE:
        raise TeamConflictError(TeamConflictReason.TEAM_FULL)
    _guarded(
        session,
        insert(models.TeamMember).values(
            team_id=team_id,
            position=len(members),
            pokemon_id=pokemon_id,
            species_id=species_id,
            family_id=family_id,
        ),
    )


def _listed_species(session: Session, pokemon_id: int) -> tuple[int, int]:
    """The species and evolution family of a Pokémon that PokéAPI lists, as (species_id,
    family_id).

    Raises UnknownPokemonError if no Pokémon has the id or its species isn't stored, and
    TeamConflictError (POKEMON_REMOVED) if PokéAPI no longer lists it.
    """
    row = session.execute(
        select(
            pokemon_models.SpeciesVariety.species_id,
            pokemon_models.Species.evolution_chain_id,
            pokemon_models.Pokemon.removed_at,
        )
        .join(
            pokemon_models.Pokemon,
            pokemon_models.Pokemon.id == pokemon_models.SpeciesVariety.pokemon_id,
        )
        .join(
            pokemon_models.Species,
            pokemon_models.Species.id == pokemon_models.SpeciesVariety.species_id,
        )
        .where(pokemon_models.SpeciesVariety.pokemon_id == pokemon_id)
    ).one_or_none()
    if row is None:
        raise UnknownPokemonError(pokemon_id)
    species_id, family_id, removed_at = row
    if removed_at is not None:
        raise TeamConflictError(TeamConflictReason.POKEMON_REMOVED)
    return species_id, family_id


def _find(members: Sequence[Member], pokemon_id: int) -> Member | None:
    return next((member for member in members if member.pokemon_id == pokemon_id), None)


def _remove(session: Session, team_id: uuid.UUID, member: Member) -> None:
    """Deletes a member and moves the members after it up a slot."""
    session.execute(delete(models.TeamMember).where(models.TeamMember.id == member.id))
    # Rows are updated in no set order, so one can briefly take a slot another hasn't left yet;
    # the slot constraint is checked once they've all moved.
    session.execute(
        update(models.TeamMember)
        .where(models.TeamMember.team_id == team_id, models.TeamMember.position > member.position)
        .values(position=models.TeamMember.position - 1)
    )


def _check_slots(session: Session) -> None:
    """Checks now, rather than at commit, that no two members share a slot, then goes back to
    checking at commit.
    """
    session.execute(text(f"set constraints {SLOT} immediate"))
    session.execute(text(f"set constraints {SLOT} deferred"))


def _guarded(session: Session, statement: Insert | Update) -> None:
    """Runs an insert or update of members, raising TeamConflictError (FAMILY_ON_TEAM) if it
    would put two Pokémon from one evolution family on the team. In a savepoint, so that doesn't
    abort the caller's transaction.
    """
    try:
        with session.begin_nested():
            session.execute(statement)
    except IntegrityError as error:
        if _violates(error, FAMILY_ON_TEAM):
            raise TeamConflictError(TeamConflictReason.FAMILY_ON_TEAM) from error
        raise


def _changed(session: Session, team: models.Team) -> schemas.Team:
    """Records that the team changed now, and returns it as the API shows it."""
    # The database's clock, which created_at also comes from. Unlike now(), it moves on within a
    # transaction.
    team.updated_at = func.clock_timestamp()
    session.flush()
    return get_team(session, team.id)


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


def _violates(error: IntegrityError, constraint: str) -> bool:
    return isinstance(error.orig, UniqueViolation) and error.orig.diag.constraint_name == constraint
