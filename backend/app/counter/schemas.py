"""Counter teams as the API takes and shows them. Descriptions appear in the API
docs.
"""

from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from app.counter.constants import MAX_TEAM_SIZE
from app.counter.enums import RelativeSpeed, Verdict
from app.pokemon.constants import MAX_POKEMON_ID
from app.pokemon.enums import PokemonType
from app.pokemon.schemas import Pokemon

PokemonId = Annotated[int, Field(ge=1, le=MAX_POKEMON_ID)]


def _each_once(pokemon_ids: list[int]) -> list[int]:
    if len(set(pokemon_ids)) != len(pokemon_ids):
        raise ValueError("Each Pokémon can be on a team only once.")
    return pokemon_ids


class TeamMatchupQuery(BaseModel):
    """A team to match Pokémon against, and which Pokémon to choose from."""

    model_config = ConfigDict(frozen=True, validate_by_name=True)

    pokemon_ids: Annotated[
        list[PokemonId],
        Field(
            alias="pokemon_id",
            min_length=1,
            max_length=MAX_TEAM_SIZE,
            description="A Pokémon's `id`. Repeat it for each of the team's Pokémon, in slot "
            "order, from one to six.",
        ),
        AfterValidator(_each_once),
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


class Attack(BaseModel):
    """A Pokémon's strongest attack on its opponent: a move of one of its own types, of the same
    power for every Pokémon, physical or special, whichever does more damage.
    """

    model_config = ConfigDict(use_attribute_docstrings=True)

    type: PokemonType
    """One of the attacker's own types."""
    multiplier: float
    """How effective the type is against the defender's types: 0, 0.25, 0.5, 1, 2 or 4."""
    hits: int | None
    """How many of these attacks knock the defender out; `null` if they do no damage."""


class Matchup(BaseModel):
    """How a Pokémon fares one-on-one against one of the team's Pokémon. Both are taken at
    level 50, and each uses its strongest attack every turn until one is knocked out.
    """

    model_config = ConfigDict(use_attribute_docstrings=True)

    opponent_id: int
    """The `id` of the team's Pokémon."""
    verdict: Verdict
    """`counter`: it can switch in, take a free hit, and still win. `check`: it wins only from
    a neutral start, where the faster Pokémon strikes first. `loses`: it doesn't win, even from
    a neutral start.
    """
    hp_left: float
    """The winner's share of its HP left at the end, from 0 to 1: this Pokémon's after
    switching in, for a `counter`; its own from a neutral start, for a `check`; the opponent's
    from a neutral start, when it `loses`.
    """
    speed: RelativeSpeed
    """How its Speed compares to the opponent's. The faster one strikes first; a tie counts
    against it, as the games settle a tie at random.
    """
    attack: Attack
    """Its strongest attack on the opponent."""
    opponent_attack: Attack
    """The opponent's strongest attack on it."""


class Challenger(BaseModel):
    """A Pokémon and how it fares one-on-one against each of a team's Pokémon."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    pokemon: Pokemon
    matchups: list[Matchup]
    """Against each of the team's Pokémon, in the order the team was given."""
