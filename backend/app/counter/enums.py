from enum import StrEnum


class Rating(StrEnum):
    """How a matchup looks for a Pokémon, from its score."""

    GOOD = "good"
    EVEN = "even"
    BAD = "bad"


class RelativeSpeed(StrEnum):
    """How a Pokémon's base Speed compares to its opponent's."""

    FASTER = "faster"
    TIED = "tied"
    SLOWER = "slower"
