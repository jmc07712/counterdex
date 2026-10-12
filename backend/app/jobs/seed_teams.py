"""Job: fill a local database with teams to browse: other users' teams, and some for an existing
user named on the command line.

uv run --env-file ../.env python -m app.jobs.seed_teams USERNAME

For local development only: it refuses a database that isn't on this machine. Running it again
adds nothing more. The users it makes get random passwords nobody knows, so no one can sign in
as them.
"""

import argparse
import logging
import secrets
import sys
import uuid
from collections.abc import Callable, Sequence
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.accounts.models import User
from app.accounts.passwords import hash_password
from app.core.db import get_engine
from app.jobs.local import is_local_database
from app.pokemon.models import Pokemon
from app.teams import models, service
from app.teams.schemas import NewTeam

logger = logging.getLogger(__name__)

# Team ids are made from their owner and name, so running the job again finds the same teams.
SEED_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_DNS, "seed.counterdex.localhost")

# The teams of the user named on the command line, by name. Pokémon are named as stored.
YOUR_TEAMS: dict[str, tuple[str, ...]] = {
    "Kanto Classics": ("charizard", "blastoise", "venusaur", "pikachu", "snorlax", "lapras"),
    "Rain Dance": ("pelipper", "kingdra", "ludicolo", "ferrothorn", "barraskewda", "politoed"),
    "Pseudo Legends": ("dragonite", "garchomp", "tyranitar", "metagross"),
    "Legends Only": ("mewtwo", "lugia", "ho-oh", "rayquaza", "kyogre", "groudon"),
    "Megas": (
        "charizard-mega-x",
        "gengar-mega",
        "lucario-mega",
        "metagross-mega",
        "garchomp-mega",
        "kangaskhan-mega",
    ),
    "Work in Progress": ("gengar", "alakazam"),
    "Empty for Now": (),
}

# Other users' teams, by username, then by name.
OTHER_TEAMS: dict[str, dict[str, tuple[str, ...]]] = {
    "ash": {
        "Journey Team": ("pikachu", "charizard", "greninja", "lucario", "infernape", "sceptile"),
        "Alola Squad": (
            "decidueye",
            "lycanroc-midday",
            "incineroar",
            "melmetal",
            "naganadel",
            "pikachu",
        ),
    },
    "misty": {
        "Cerulean Gym": ("starmie", "gyarados", "lapras", "golduck", "vaporeon", "kingdra"),
        "Water Veil": ("azumarill", "swampert", "toxapex", "primarina"),
    },
    "brock": {
        "Rock Solid": ("steelix", "golem", "rhyperior", "kabutops", "omastar", "aerodactyl"),
        "Pewter Basics": ("geodude",),
    },
    "cynthia": {
        "Champion of Sinnoh": (
            "garchomp",
            "spiritomb",
            "lucario",
            "togekiss",
            "milotic",
            "roserade",
        ),
        "Trick Room": ("hatterene", "porygon2", "conkeldurr", "rhyperior", "reuniclus", "mudsdale"),
    },
    "red": {
        "Mt. Silver": ("pikachu", "espeon", "snorlax", "venusaur", "charizard", "blastoise"),
        "Fresh Start": ("eevee",),
    },
    "blue": {
        "Rival Battle": ("pidgeot", "alakazam", "rhydon", "exeggutor", "gyarados", "arcanine"),
        "Sun Team": ("torkoal", "venusaur", "ninetales", "heatran", "lilligant"),
    },
    "steven": {
        "Steel Will": ("metagross", "skarmory", "aggron", "cradily", "armaldo", "claydol"),
    },
    "lance": {
        "Dragon Master": (
            "dragonite",
            "gyarados",
            "aerodactyl",
            "charizard",
            "kingdra",
            "salamence",
        ),
    },
    "leon": {
        "Galar Champion": (
            "charizard",
            "dragapult",
            "aegislash-shield",
            "haxorus",
            "rhyperior",
            "seismitoad",
        ),
        "Exhibition": ("cinderace", "inteleon"),
    },
    "morty": {
        "Ghost Monotype": (
            "gengar",
            "mismagius",
            "chandelure",
            "dragapult",
            "mimikyu-disguised",
            "aegislash-shield",
        ),
    },
    "sabrina": {
        "Psychic Power": ("alakazam", "mr-mime", "gardevoir", "espeon"),
    },
    "nemona": {
        "Paradox Party": (
            "great-tusk",
            "iron-valiant",
            "flutter-mane",
            "iron-bundle",
            "roaring-moon",
            "iron-hands",
        ),
        "Paldea Picks": (
            "meowscarada",
            "skeledirge",
            "quaquaval",
            "kingambit",
            "annihilape",
            "gholdengo",
        ),
    },
    "bugsy": {
        "Bug Catcher": ("scizor", "heracross", "volcarona"),
    },
}


def main(argv: Sequence[str], sessions: Callable[[], Session]) -> int:
    """Run the job with these command-line arguments; return the process exit code."""
    parser = argparse.ArgumentParser(
        prog="python -m app.jobs.seed_teams",
        description="Fill a local database with teams, some of them the named user's.",
    )
    parser.add_argument("username", help="An existing user to give teams. Case doesn't matter.")
    arguments = parser.parse_args(argv)

    if not is_local_database():
        logger.error("Refusing to seed a database that isn't on this machine.")
        return 1

    with sessions() as session:
        you = _find_user(session, arguments.username)
        if you is None:
            logger.error("No user has the username %s.", arguments.username)
            return 1
        # Others' teams first and yours last, so yours are the newest.
        owned = [
            (_find_or_add_user(session, username), teams) for username, teams in OTHER_TEAMS.items()
        ]
        owned.append((you, YOUR_TEAMS))
        seeds = [
            (owner, name, members) for owner, teams in owned for name, members in teams.items()
        ]

        pokemon_ids = _pokemon_ids(session, {name for _, _, members in seeds for name in members})
        missing = {name for _, _, members in seeds for name in members} - pokemon_ids.keys()
        if missing:
            logger.error("No Pokémon has the name: %s", ", ".join(sorted(missing)))
            return 1

        now = datetime.now(UTC)
        added = 0
        for age, (owner, name, members) in enumerate(reversed(seeds), start=1):
            team, is_new = service.create_team(
                session,
                owner.id,
                uuid.uuid5(SEED_NAMESPACE, f"{owner.username.lower()}/{name}"),
                NewTeam(name=name, pokemon_ids=[pokemon_ids[each] for each in members]),
            )
            if is_new:
                _backdate(session, team.id, now, age)
                added += 1
        session.commit()

    logger.info("Added %d teams; %d were there already.", added, len(seeds) - added)
    return 0


def _find_user(session: Session, username: str) -> User | None:
    return session.scalars(
        select(User).where(func.lower(User.username) == username.lower())
    ).one_or_none()


def _find_or_add_user(session: Session, username: str) -> User:
    user = _find_user(session, username)
    if user is None:
        user = User(username=username, password_hash=hash_password(secrets.token_urlsafe(32)))
        session.add(user)
        session.flush()
    return user


def _pokemon_ids(session: Session, names: set[str]) -> dict[str, int]:
    rows = session.execute(select(Pokemon.name, Pokemon.id).where(Pokemon.name.in_(names)))
    return {row.name: row.id for row in rows}


def _backdate(session: Session, team_id: uuid.UUID, now: datetime, age: int) -> None:
    """Spread the teams over the past weeks, so lists sorted by date look lived in. Every third
    team was never changed after it was made.
    """
    created_ago = timedelta(days=age, hours=(age * 5) % 24)
    updated_ago = created_ago if age % 3 == 0 else created_ago * 0.4
    session.execute(
        update(models.Team)
        .where(models.Team.id == team_id)
        .values(created_at=now - created_ago, updated_at=now - updated_ago)
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    sys.exit(main(sys.argv[1:], lambda: Session(get_engine())))
