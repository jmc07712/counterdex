from app.teams.enums import TeamConflictReason


class TeamNotFoundError(Exception):
    """No team has this id."""


class NotTeamOwnerError(Exception):
    """The team is someone else's, and only its owner can change it."""


class UserNotFoundError(Exception):
    """No user has this username, in any combination of upper and lower case."""


class MemberNotFoundError(Exception):
    """The Pokémon isn't on the team."""


class UnknownPokemonError(Exception):
    """No Pokémon has this id, or a sync hasn't stored its species yet."""


class TeamConflictError(Exception):
    """The change can't be made to the team as it is now."""

    def __init__(self, reason: TeamConflictReason) -> None:
        super().__init__(reason)
        self.reason = reason
