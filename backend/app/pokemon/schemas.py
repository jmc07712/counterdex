"""A Pokémon's data, defined once: the sync builds it from PokéAPI, the table stores it and the
API serves it. Descriptions are written for API users; they appear in the docs.
"""

from collections.abc import Mapping
from datetime import datetime
from typing import Annotated, Any, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationInfo,
    field_validator,
)

from app.core.text import NO_NUL
from app.pokemon.constants import (
    DEFAULT_PAGE_SIZE,
    FORM_MARKERS,
    MAX_BASE_STAT,
    MAX_PAGE_SIZE,
    MAX_POKEMON_ID,
    MAX_SEARCH_LENGTH,
    MAX_TYPES,
    MIN_BASE_STAT,
    MIN_TYPES,
)
from app.pokemon.enums import (
    EvolutionTrigger,
    FormFilter,
    Gender,
    ListingStatus,
    PokemonForm,
    PokemonType,
    RelativePhysicalStats,
    TimeOfDay,
)

BaseStat = Annotated[int, Field(ge=MIN_BASE_STAT, le=MAX_BASE_STAT)]


class Stats(BaseModel):
    """A Pokémon's base stats, each from 1 to 255."""

    model_config = ConfigDict(frozen=True)

    hp: BaseStat
    attack: BaseStat
    defense: BaseStat
    sp_attack: BaseStat
    sp_defense: BaseStat
    speed: BaseStat


# The pokemon table gives each stat its own column, named after these fields.
STAT_NAMES = tuple(Stats.model_fields)


# Fields that aren't the pokemon table's columns: stats are spread over six columns, and the rest
# are worked out from other columns.
NOT_COLUMNS = {"stats", "form", "changed_recently", "species_id", "family_id"}


# The sync detects changes by hashing exactly these fields, so adding one changes every stored
# hash and the next sync records every Pokémon as updated (a pinned-hash test guards this).
class Pokemon(BaseModel):
    """A Pokémon: its Pokédex number, name, types, base stats and sprite."""

    model_config = ConfigDict(frozen=True)

    id: Annotated[
        int, Field(description="Pokédex number. Alternate forms are numbered from 10001.")
    ]
    name: Annotated[str, Field(description="Lowercase and hyphenated, e.g. `charizard-mega-x`.")]
    types: Annotated[
        tuple[PokemonType, ...],
        Field(
            min_length=MIN_TYPES,
            max_length=MAX_TYPES,
            description="One or two types, primary type first.",
        ),
    ]
    stats: Stats
    sprite_url: Annotated[
        str | None, Field(description="Front-facing sprite image, or `null` if there isn't one.")
    ]
    is_default: Annotated[
        bool,
        Field(
            description="`false` for alternate forms, such as Mega Evolutions and regional forms."
        ),
    ]

    # Worked out from the name by the validator below, so it's never stored or taken as input.
    form: Annotated[
        PokemonForm | None,
        Field(
            validate_default=True,
            description="The kind of alternate form, such as `mega` or `alolan`; `null` for a "
            "default form.",
        ),
    ] = None

    # Worked out by the queries from when a sync last changed it, so, like `form`, it's never
    # stored or hashed.
    changed_recently: Annotated[
        bool,
        Field(
            description="Whether a sync changed it in the last week: updated it, removed it or "
            "listed it again."
        ),
    ] = False

    # Looked up by the queries in species_varieties, so, like `form`, it's never stored or
    # hashed.
    species_id: Annotated[
        int | None,
        Field(
            description="Its species' id, which is the species' Pokédex number; `null` until a "
            "sync has stored its species, and always `null` in a change's `before` and `after`."
        ),
    ] = None

    # Looked up by the queries in species, through species_varieties, so, like `form`, it's never
    # stored or hashed.
    family_id: Annotated[
        int | None,
        Field(
            description="Its evolution family's id (PokéAPI's evolution chain); `null` until a "
            "sync has stored its species, and always `null` in a change's `before` and `after`."
        ),
    ] = None

    @field_validator("form", mode="before")
    @classmethod
    def classify_form(cls, _form: object, info: ValidationInfo) -> PokemonForm | None:
        # name and is_default are declared above, so they're already validated here.
        if info.data.get("is_default", True):
            return None
        words = str(info.data.get("name", "")).split("-")
        return next(
            (form for marker, form in FORM_MARKERS.items() if marker in words), PokemonForm.OTHER
        )

    @classmethod
    def from_columns(cls, columns: Mapping[Any, Any]) -> Self:
        """Read a Pokémon from the pokemon table's columns, ignoring the sync's bookkeeping."""
        fields = {name: columns[name] for name in cls.model_fields if name not in NOT_COLUMNS}
        stats = {name: columns[name] for name in STAT_NAMES}
        return cls.model_validate(fields | {"stats": stats})

    def to_columns(self) -> dict[str, Any]:
        """The Pokémon as the pokemon table's columns, as plain JSON-ready values."""
        # The form and recent changes are worked out, so they aren't stored (or hashed).
        fields = self.model_dump(mode="json", exclude=NOT_COLUMNS)
        return fields | self.stats.model_dump(mode="json")


class EvolutionMethod(BaseModel):
    """One way a species evolves from the one before it in the latest games: what sets it off,
    and any conditions on top. Conditions that don't apply are `null` or `false`. Items, moves,
    species and places are named as in PokéAPI, e.g. `thunder-stone`.
    """

    model_config = ConfigDict(frozen=True, use_attribute_docstrings=True)

    trigger: EvolutionTrigger
    """What sets the evolution off."""
    min_level: int | None = None
    """The level it must reach."""
    item: str | None = None
    """The item to use on it."""
    held_item: str | None = None
    """The item it must hold."""
    known_move: str | None = None
    """A move it must know."""
    known_move_type: PokemonType | None = None
    """It must know a move of this type."""
    used_move: str | None = None
    """The move it must use."""
    min_move_count: int | None = None
    """How many times it must use `used_move`."""
    trade_species: str | None = None
    """The species it must be traded for."""
    party_species: str | None = None
    """A species that must be in the party."""
    party_type: PokemonType | None = None
    """A Pokémon of this type must be in the party."""
    min_happiness: int | None = None
    """The friendship it must have, at least."""
    min_steps: int | None = None
    """How many steps it must walk, at least."""
    min_damage_taken: int | None = None
    """How much damage it must take, at least."""
    relative_physical_stats: RelativePhysicalStats | None = None
    """How its Attack must compare to its Defense."""
    location: str | None = None
    """Where it must be."""
    region: str | None = None
    """The region it must be in."""
    time_of_day: TimeOfDay | None = None
    """When it must be."""
    gender: Gender | None = None
    """Only Pokémon of this gender evolve this way."""
    needs_overworld_rain: bool = False
    """It must be raining."""
    needs_multiplayer: bool = False
    """It must be with another player."""
    turn_upside_down: bool = False
    """The console must be held upside down."""
    chance: int | None = None
    """The percent chance of evolving this way, when it's left to chance."""


class Species(BaseModel):
    """A species: the Pokémon that share a Pokédex number, such as Charizard and its Mega forms."""

    model_config = ConfigDict(frozen=True)

    id: Annotated[int, Field(description="Pokédex number.")]
    name: Annotated[str, Field(description="Lowercase and hyphenated, e.g. `mr-mime`.")]
    genus: Annotated[
        str | None, Field(description='How the Pokédex describes it, e.g. "Flame Pokémon".')
    ]


class EvolutionStage(BaseModel):
    """A species in an evolution family: how it evolves from the stage before, and what it
    evolves into.
    """

    species: Species
    pokemon: Annotated[
        Pokemon | None,
        Field(description="Its default form, or `null` if PokéAPI no longer lists it."),
    ]
    methods: Annotated[
        list[EvolutionMethod],
        Field(description="Each way it evolves from the stage before; none for the first stage."),
    ]
    evolves_to: Annotated[
        list["EvolutionStage"],
        Field(description="The species it evolves into: more than one where evolution branches."),
    ]


class PokemonDetails(BaseModel):
    """A Pokémon with its species, the species' other forms, and its evolution family."""

    pokemon: Pokemon
    removed_at: Annotated[
        datetime | None,
        Field(description="When PokéAPI stopped listing it, or `null` while it's listed."),
    ]
    species: Annotated[
        Species | None, Field(description="Its species, or `null` until a sync has stored it.")
    ]
    forms: Annotated[
        list[Pokemon],
        Field(
            description="Every form of its species that PokéAPI lists, this one included, in "
            "Pokédex order."
        ),
    ]
    evolution: Annotated[
        EvolutionStage | None,
        Field(
            description="Its evolution family from the first stage, or `null` until a sync has "
            "stored it."
        ),
    ]


class PokemonPage(BaseModel):
    """One page of Pokémon."""

    items: Annotated[list[Pokemon], Field(description="This page's Pokémon, in Pokédex order.")]
    next_cursor: Annotated[
        int | None,
        Field(description="Pass as `cursor` to get the next page; `null` on the last page."),
    ]


SearchText = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, to_lower=True, min_length=1, max_length=MAX_SEARCH_LENGTH
    ),
    NO_NUL,
]


def as_stored_name(search: str) -> str:
    """Search text as Pokémon names are stored: lowercase and hyphenated ("charizard-mega-x"),
    so "Mega X" matches. The text must be lowercase already, as SearchText makes it.
    """
    return "-".join(search.split())


class PokemonQuery(BaseModel):
    """Which Pokémon to list, and which page. A Pokémon must match every filter given."""

    model_config = ConfigDict(frozen=True, validate_by_name=True)

    q: Annotated[
        SearchText | None,
        Field(description="Part of a name, e.g. `char` or `mega x`. Case doesn't matter."),
    ] = None
    types: Annotated[
        tuple[PokemonType, ...],
        Field(
            alias="type",
            max_length=MAX_TYPES,
            description="Only Pokémon of this type. Repeat it (`type=fire&type=flying`) to "
            "require both.",
        ),
    ] = ()
    forms: Annotated[
        FormFilter,
        Field(
            description="Which forms to list: `all`, only `default` forms, or only `alternate` "
            "forms such as Mega Evolutions and regional forms."
        ),
    ] = FormFilter.ALL
    status: Annotated[
        ListingStatus,
        Field(
            description="`listed` for the Pokémon PokéAPI lists, or `removed` for the ones it "
            "no longer does."
        ),
    ] = ListingStatus.LISTED
    changed: Annotated[
        bool,
        Field(
            description="Only Pokémon a sync has changed in the last week: updated, removed or "
            "listed again."
        ),
    ] = False
    limit: Annotated[
        int, Field(ge=1, le=MAX_PAGE_SIZE, description="How many Pokémon per page.")
    ] = DEFAULT_PAGE_SIZE
    cursor: Annotated[
        int | None,
        Field(
            ge=1,
            le=MAX_POKEMON_ID,
            description="Where to continue from: the previous page's `next_cursor`. Leave it out "
            "for the first page.",
        ),
    ] = None

    @field_validator("q")
    @classmethod
    def match_stored_names(cls, q: str | None) -> str | None:
        return None if q is None else as_stored_name(q)
