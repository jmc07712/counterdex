from app.teams.enums import TeamConflictReason


class TeamNotFoundError(Exception):
    """The user has no team with this id."""


class MemberNotFoundError(Exception):
    """The Pokémon isn't on the team."""


class UnknownPokemonError(Exception):
    """No Pokémon has this id, or a sync hasn't stored its species yet."""


class TeamConflictError(Exception):
    """The change can't be made to the team as it is now."""

    def __init__(self, reason: TeamConflictReason) -> None:
        super().__init__(reason)
        self.reason = reason
