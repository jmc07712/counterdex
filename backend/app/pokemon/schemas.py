"""A Pokémon's data, defined once: the sync builds it from PokéAPI, the table stores it and the
API serves it. Descriptions are written for API users; they appear in the docs.
"""

from collections.abc import Mapping
from typing import Annotated, Any, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    ValidationInfo,
    field_validator,
)

from app.pokemon.constants import (
    DEFAULT_PAGE_SIZE,
    FORM_MARKERS,
    MAX_BASE_STAT,
    MAX_CURSOR,
    MAX_PAGE_SIZE,
    MAX_SEARCH_LENGTH,
    MAX_TYPES,
    MIN_BASE_STAT,
    MIN_TYPES,
)
from app.pokemon.enums import PokemonForm, PokemonType

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
        fields = {name: columns[name] for name in cls.model_fields if name not in {"stats", "form"}}
        stats = {name: columns[name] for name in STAT_NAMES}
        return cls.model_validate(fields | {"stats": stats})

    def to_columns(self) -> dict[str, Any]:
        """The Pokémon as the pokemon table's columns, as plain JSON-ready values."""
        # The form kind is worked out from the name, so it isn't stored (or hashed).
        fields = self.model_dump(mode="json", exclude={"stats", "form"})
        return fields | self.stats.model_dump(mode="json")


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
]


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
        bool,
        Field(description="Include alternate forms, such as Mega Evolutions and regional forms."),
    ] = True
    limit: Annotated[
        int, Field(ge=1, le=MAX_PAGE_SIZE, description="How many Pokémon per page.")
    ] = DEFAULT_PAGE_SIZE
    cursor: Annotated[
        int | None,
        Field(
            ge=1,
            le=MAX_CURSOR,
            description="Where to continue from: the previous page's `next_cursor`. Leave it out "
            "for the first page.",
        ),
    ] = None

    @field_validator("q")
    @classmethod
    def match_stored_names(cls, q: str | None) -> str | None:
        # Names are stored lowercase and hyphenated ("charizard-mega-x"), so "Mega X" matches.
        return None if q is None else "-".join(q.split())
