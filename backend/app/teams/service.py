"""Teams and the Pokémon on them.

Every change locks the team's row first, so changes to one team happen one at a time and each
sees the result of the one before. Nothing here commits: the caller owns the transaction.
"""

import uuid
from collections import defaultdict
from collections.abc import Collection, Mapping, Sequence
from typing import Any

from psycopg.errors import UniqueViolation
from sqlalchemy import Insert, Row, Update, func, insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.pokemon import models as pokemon_models
from app.pokemon.queries import pokemon_from_columns
from app.teams import models, schemas
from app.teams.constants import MAX_TEAM_SIZE
from app.teams.enums import TeamConflictReason
from app.teams.exceptions import TeamConflictError, TeamNotFoundError, UnknownPokemonError

SPECIES_ON_TEAM = "uq_team_members_team_id_species_id"
TEAM_ID = "pk_teams"

# A member's row: id, position, pokemon_id and species_id.
Member = Row[int, int, int, int]


def list_teams(session: Session, user_id: int) -> list[schemas.Team]:
    """The user's teams, most recently changed first."""
    teams = session.scalars(
        select(models.Team)
        .where(models.Team.user_id == user_id)
        .order_by(models.Team.updated_at.desc(), models.Team.created_at.desc())
    ).all()
    return _shown(session, teams)


def get_team(session: Session, user_id: int, team_id: uuid.UUID) -> schemas.Team:
    """One of the user's teams. Raises TeamNotFoundError if they have none with this id."""
    team = session.scalars(
        select(models.Team).where(models.Team.id == team_id, models.Team.user_id == user_id)
    ).one_or_none()
    if team is None:
        raise TeamNotFoundError(team_id)
    return _shown_one(session, team)


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
        return get_team(session, user_id, team_id), False
    for pokemon_id in new.pokemon_ids:
        _append(session, team_id, pokemon_id)
    return _shown_one(session, team), True


def rename_team(session: Session, user_id: int, team_id: uuid.UUID, name: str) -> schemas.Team:
    """Renames one of the user's teams. Raises TeamNotFoundError if they have none with this id."""
    team = _locked(session, user_id, team_id)
    team.name = name
    return _changed(session, team)


def delete_team(session: Session, user_id: int, team_id: uuid.UUID) -> None:
    """Deletes one of the user's teams and its members. Raises TeamNotFoundError if they have
    none with this id.
    """
    team = _locked(session, user_id, team_id)
    session.delete(team)
    session.flush()


def _locked(session: Session, user_id: int, team_id: uuid.UUID) -> models.Team:
    """The user's team, its row locked until the transaction ends: other changes to the team
    wait for this one. Raises TeamNotFoundError if they have none with this id.
    """
    team = session.scalars(
        select(models.Team)
        .where(models.Team.id == team_id, models.Team.user_id == user_id)
        .with_for_update()
        # Reloaded, so the lock's read replaces anything the session read before it.
        .execution_options(populate_existing=True)
    ).one_or_none()
    if team is None:
        raise TeamNotFoundError(team_id)
    return team


def _members(session: Session, team_id: uuid.UUID) -> Sequence[Member]:
    """The team's members, in slot order."""
    return session.execute(
        select(
            models.TeamMember.id,
            models.TeamMember.position,
            models.TeamMember.pokemon_id,
            models.TeamMember.species_id,
        )
        .where(models.TeamMember.team_id == team_id)
        .order_by(models.TeamMember.position)
    ).all()


def _append(session: Session, team_id: uuid.UUID, pokemon_id: int) -> None:
    """Puts a Pokémon in the team's next free slot.

    Raises as _listed_species does, and TeamConflictError with SPECIES_ON_TEAM if the species is
    on the team already, or TEAM_FULL if it has six members.
    """
    members = _members(session, team_id)
    species_id = _listed_species(session, pokemon_id)
    if any(member.species_id == species_id for member in members):
        raise TeamConflictError(TeamConflictReason.SPECIES_ON_TEAM)
    if len(members) >= MAX_TEAM_SIZE:
        raise TeamConflictError(TeamConflictReason.TEAM_FULL)
    _guarded(
        session,
        insert(models.TeamMember).values(
            team_id=team_id, position=len(members), pokemon_id=pokemon_id, species_id=species_id
        ),
    )


def _listed_species(session: Session, pokemon_id: int) -> int:
    """The species of a Pokémon that PokéAPI lists.

    Raises UnknownPokemonError if no Pokémon has the id or its species isn't stored, and
    TeamConflictError (POKEMON_REMOVED) if PokéAPI no longer lists it.
    """
    row = session.execute(
        select(pokemon_models.SpeciesVariety.species_id, pokemon_models.Pokemon.removed_at)
        .join(
            pokemon_models.Pokemon,
            pokemon_models.Pokemon.id == pokemon_models.SpeciesVariety.pokemon_id,
        )
        .where(pokemon_models.SpeciesVariety.pokemon_id == pokemon_id)
    ).one_or_none()
    if row is None:
        raise UnknownPokemonError(pokemon_id)
    if row.removed_at is not None:
        raise TeamConflictError(TeamConflictReason.POKEMON_REMOVED)
    species_id: int = row.species_id
    return species_id


def _guarded(session: Session, statement: Insert | Update) -> None:
    """Runs an insert or update of members, raising TeamConflictError (SPECIES_ON_TEAM) if it
    would put a species on the team twice. In a savepoint, so that doesn't abort the caller's
    transaction.
    """
    try:
        with session.begin_nested():
            session.execute(statement)
    except IntegrityError as error:
        if _violates(error, SPECIES_ON_TEAM):
            raise TeamConflictError(TeamConflictReason.SPECIES_ON_TEAM) from error
        raise


def _changed(session: Session, team: models.Team) -> schemas.Team:
    """Records that the team changed now, and returns it as the API shows it."""
    # The database's clock, which created_at also comes from. Unlike now(), it moves on within a
    # transaction.
    team.updated_at = func.clock_timestamp()
    session.flush()
    return _shown_one(session, team)


def _shown_one(session: Session, team: models.Team) -> schemas.Team:
    (shown,) = _shown(session, [team])
    return shown


def _shown(session: Session, teams: Sequence[models.Team]) -> list[schemas.Team]:
    """The teams as the API shows them, each with its members in slot order."""
    rows = (
        session.execute(
            select(
                models.TeamMember.team_id,
                models.TeamMember.position,
                pokemon_models.Pokemon.__table__,
                models.TeamMember.species_id,
            )
            .join(pokemon_models.Pokemon, pokemon_models.Pokemon.id == models.TeamMember.pokemon_id)
            .where(models.TeamMember.team_id.in_([team.id for team in teams]))
            .order_by(models.TeamMember.position)
        )
        .mappings()
        .all()
    )
    earlier = _earlier_stages(session, {row["species_id"] for row in rows})
    by_team: defaultdict[uuid.UUID, list[Mapping[Any, Any]]] = defaultdict(list)
    for row in rows:
        by_team[row["team_id"]].append(row)
    return [
        schemas.Team(
            id=team.id,
            name=team.name,
            created_at=team.created_at,
            updated_at=team.updated_at,
            members=_members_shown(by_team[team.id], earlier),
        )
        for team in teams
    ]


def _members_shown(
    rows: Sequence[Mapping[Any, Any]], earlier: Mapping[int, set[int]]
) -> list[schemas.TeamMember]:
    """Members as the API shows them, from rows of a position, the pokemon table's columns and
    a species_id.
    """

    def related(one: int, other: int) -> bool:
        return one in earlier[other] or other in earlier[one]

    return [
        schemas.TeamMember(
            position=row["position"],
            pokemon=pokemon_from_columns(row),
            removed_at=row["removed_at"],
            related_pokemon_ids=[
                other["id"]
                for other in rows
                if other["id"] != row["id"] and related(row["species_id"], other["species_id"])
            ],
        )
        for row in rows
    ]


def _earlier_stages(session: Session, species_ids: Collection[int]) -> dict[int, set[int]]:
    """Each species' earlier stages: what it evolves from, what that evolves from, and so on."""
    families = select(pokemon_models.Species.evolution_chain_id).where(
        pokemon_models.Species.id.in_(species_ids)
    )
    evolves_from: dict[int, int | None] = dict(
        session.execute(
            select(pokemon_models.Species.id, pokemon_models.Species.evolves_from_species_id).where(
                pokemon_models.Species.evolution_chain_id.in_(families)
            )
        ).all()
    )
    earlier: dict[int, set[int]] = {}
    for species_id in species_ids:
        stages: set[int] = set()
        stage = evolves_from.get(species_id)
        while stage is not None:
            stages.add(stage)
            stage = evolves_from.get(stage)
        earlier[species_id] = stages
    return earlier


def _violates(error: IntegrityError, constraint: str) -> bool:
    return isinstance(error.orig, UniqueViolation) and error.orig.diag.constraint_name == constraint
