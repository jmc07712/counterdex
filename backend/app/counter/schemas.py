"""Counter teams and threats as the API takes and shows them. Descriptions appear in the API
docs.
"""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

from app.counter.constants import (
    BAD_SCORE,
    GOOD_SCORE,
    NO_EFFECT_POINTS,
    POWER_WEIGHT,
    SPEED_POINTS,
    STAT_TOTAL_STEP,
)
from app.counter.enums import Rating, RelativeSpeed
from app.pokemon.enums import PokemonType
from app.pokemon.schemas import Pokemon, PokemonIds


class TeamMatchupQuery(BaseModel):
    """A team to match Pokémon against, and which Pokémon to choose from."""

    model_config = ConfigDict(frozen=True, validate_by_name=True)

    pokemon_ids: Annotated[
        PokemonIds,
        Field(
            alias="pokemon_id",
            min_length=1,
            description="A Pokémon's `id`. Repeat it for each of the team's Pokémon, in slot "
            "order, from one to six, each once.",
        ),
    ]
    forms: Annotated[
        bool,
        Field(
            description="Also choose from alternate forms, such as Mega Evolutions and regional "
            "forms."
        ),
    ] = False
    legendaries: Annotated[
        bool, Field(description="Also choose from legendary and mythical Pokémon.")
    ] = False


class MatchupsQuery(BaseModel):
    """Our team and theirs, to score against each other."""

    model_config = ConfigDict(frozen=True, validate_by_name=True)

    pokemon_ids: Annotated[
        PokemonIds,
        Field(
            alias="pokemon_id",
            min_length=1,
            description="One of our Pokémon's `id`. Repeat it for each of our Pokémon, in battle "
            "order, from one to six, each once.",
        ),
    ]
    opponent_ids: Annotated[
        PokemonIds,
        Field(
            alias="opponent_id",
            min_length=1,
            description="One of their Pokémon's `id`. Repeat it for each of their Pokémon, in "
            "battle order, from one to six, each once.",
        ),
    ]


class Attack(BaseModel):
    """A Pokémon's most effective type against its opponent: of its own types, the one whose
    multiplier against the opponent's types is highest, its primary type on a tie.
    """

    model_config = ConfigDict(use_attribute_docstrings=True)

    type: PokemonType
    """One of the attacking Pokémon's own types."""
    multiplier: float
    """How much damage the type does to the opponent's types, multiplied together: 0, 0.25,
    0.5, 1, 2 or 4.
    """


SCORE = (
    "How well it matches up against the opponent: offense + defense + power + speed. Offense is "
    "the points for its attack's multiplier, log2 of it, so 4x is +2, 2x +1, 1x 0, 1/2x -1 and "
    f"1/4x -2, and no effect {NO_EFFECT_POINTS}. Defense is the points for the opponent's attack, "
    f"turned around. Power is +{POWER_WEIGHT} for each {STAT_TOTAL_STEP} of base stat total it "
    f"has over the opponent and -{POWER_WEIGHT} for each {STAT_TOTAL_STEP} under. Speed is "
    f"+{SPEED_POINTS} if it's faster, -{SPEED_POINTS} if it's slower and 0 on a tie. The "
    "opponent's side of the matchup scores the opposite."
)
RATING = (
    f"`good` for a score of {GOOD_SCORE} or more, `bad` for {BAD_SCORE} or less, and otherwise "
    "`even`."
)


class Matchup(BaseModel):
    """How a Pokémon matches up against one of the team's Pokémon, from its types and base stats
    alone.
    """

    model_config = ConfigDict(use_attribute_docstrings=True)

    opponent_id: int
    """The `id` of the team's Pokémon."""
    attack: Attack
    """Its most effective type against the opponent."""
    opponent_attack: Attack
    """The opponent's most effective type against it."""
    speed: RelativeSpeed
    """How its base Speed compares to the opponent's."""
    stat_total_difference: int
    """Its base stat total less the opponent's."""
    score: Annotated[float, Field(description=SCORE)]
    rating: Annotated[Rating, Field(description=RATING)]


class Challenger(BaseModel):
    """A Pokémon and how it matches up against each of a team's Pokémon."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    pokemon: Pokemon
    matchups: list[Matchup]
    """Against each of the team's Pokémon, in the order the team was given."""


class Answer(BaseModel):
    """Our best answer to one of their Pokémon."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    pokemon_id: int
    """The `id` of our Pokémon with the best score against it; the first in our order, on a tie."""
    matchup: Matchup
    """That Pokémon's matchup against it."""


class TeamMatchups(BaseModel):
    """Our team scored against theirs."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    members: list[Challenger]
    """Our Pokémon, in the order given, each with its matchup against each of theirs."""
    answers: list[Answer]
    """Our best answer to each of their Pokémon, in their order."""
    every_opponent_answered: bool
    """Whether every one of their Pokémon has an answer rated `good`."""
