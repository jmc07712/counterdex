from enum import StrEnum


class Verdict(StrEnum):
    """How a Pokémon fares one-on-one against an opponent, in the competitive sense."""

    # It can switch in, take a free hit, and still win.
    COUNTER = "counter"
    # It wins only from a neutral start, where the faster Pokémon strikes first.
    CHECK = "check"
    # It doesn't win, even from a neutral start.
    LOSES = "loses"


class RelativeSpeed(StrEnum):
    """How a Pokémon's Speed compares to its opponent's. The faster one strikes first; the games
    settle a tie at random.
    """

    FASTER = "faster"
    TIED = "tied"
    SLOWER = "slower"
