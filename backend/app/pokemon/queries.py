from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import Any

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.pokemon import models, schemas
from app.pokemon.constants import CDN_SPRITES_URL, GITHUB_SPRITES_URL
from app.pokemon.enums import FormFilter, ListingStatus


def list_pokemon(session: Session, query: schemas.PokemonQuery) -> schemas.PokemonPage:
    """One page of the matching Pokémon, by Pokédex number, after the cursor."""
    statement = select(models.Pokemon.__table__).order_by(models.Pokemon.id)
    if query.status is ListingStatus.LISTED:
        statement = statement.where(models.Pokemon.removed_at.is_(None))
    else:
        statement = statement.where(models.Pokemon.removed_at.is_not(None))
    if query.cursor is not None:
        statement = statement.where(models.Pokemon.id > query.cursor)
    if query.q is not None:
        # Escaped, so a % or _ in the search matches itself rather than acting as a wildcard.
        statement = statement.where(models.Pokemon.name.icontains(query.q, autoescape=True))
    if query.types:
        # Postgres's @> (contains): the Pokémon has every requested type.
        types = [type_.value for type_ in query.types]
        statement = statement.where(models.Pokemon.types.contains(types))
    if query.forms is not FormFilter.ALL:
        is_default = query.forms is FormFilter.DEFAULT
        statement = statement.where(models.Pokemon.is_default.is_(is_default))
    # One extra row shows whether another page follows, without counting the rest.
    rows = session.execute(statement.limit(query.limit + 1)).mappings().all()

    items = [pokemon_from_columns(row) for row in rows[: query.limit]]
    next_cursor = items[-1].id if len(rows) > query.limit else None
    return schemas.PokemonPage(items=items, next_cursor=next_cursor)


def pokemon_exists(session: Session, pokemon_id: int) -> bool:
    """Whether a Pokémon has the id, listed or not."""
    return bool(session.scalar(select(exists().where(models.Pokemon.id == pokemon_id))))


def get_pokemon_details(session: Session, pokemon_id: int) -> schemas.PokemonDetails | None:
    """A Pokémon, listed or not, with its species' forms and its evolution family; None if no
    Pokémon has the id.
    """
    row = (
        session.execute(select(models.Pokemon.__table__).where(models.Pokemon.id == pokemon_id))
        .mappings()
        .one_or_none()
    )
    if row is None:
        return None
    species = session.scalars(
        select(models.Species)
        .join(models.SpeciesVariety, models.SpeciesVariety.species_id == models.Species.id)
        .where(models.SpeciesVariety.pokemon_id == pokemon_id)
    ).one_or_none()
    if species is None:
        # A sync stores a Pokémon before its species, so this lasts until a sync stores both.
        return schemas.PokemonDetails(
            pokemon=pokemon_from_columns(row),
            removed_at=row["removed_at"],
            species=None,
            forms=[],
            evolution=None,
        )
    return schemas.PokemonDetails(
        pokemon=pokemon_from_columns(row),
        removed_at=row["removed_at"],
        species=_species(species),
        forms=[form for _, form in _listed_forms(session, [species.id])],
        evolution=_evolution_family(session, species.evolution_chain_id),
    )


def _evolution_family(session: Session, family_id: int) -> schemas.EvolutionStage:
    """The evolution family, as a tree from its first stage."""
    family = session.scalars(
        select(models.Species)
        .where(models.Species.evolution_chain_id == family_id)
        .order_by(models.Species.id)
    ).all()
    default_forms = {
        species_id: form
        for species_id, form in _listed_forms(session, [species.id for species in family])
        if form.is_default
    }
    evolutions: defaultdict[int | None, list[models.Species]] = defaultdict(list)
    for species in family:
        evolutions[species.evolves_from_species_id].append(species)

    def stage(species: models.Species) -> schemas.EvolutionStage:
        return schemas.EvolutionStage(
            species=_species(species),
            pokemon=default_forms.get(species.id),
            methods=[
                schemas.EvolutionMethod.model_validate(method)
                for method in species.evolution_methods
            ],
            evolves_to=[stage(evolution) for evolution in evolutions[species.id]],
        )

    # A family is stored whole, so it has exactly one first stage: the species that evolves from
    # nothing.
    (first,) = evolutions[None]
    return stage(first)


def _listed_forms(
    session: Session, species_ids: Sequence[int]
) -> list[tuple[int, schemas.Pokemon]]:
    """The Pokémon of these species that PokéAPI lists, each with its species' id, by Pokédex
    number.
    """
    rows = session.execute(
        select(models.Pokemon.__table__, models.SpeciesVariety.species_id)
        .join(models.SpeciesVariety, models.SpeciesVariety.pokemon_id == models.Pokemon.id)
        .where(
            models.SpeciesVariety.species_id.in_(species_ids),
            models.Pokemon.removed_at.is_(None),
        )
        .order_by(models.Pokemon.id)
    ).mappings()
    return [(row["species_id"], pokemon_from_columns(row)) for row in rows]


def pokemon_from_columns(columns: Mapping[Any, Any]) -> schemas.Pokemon:
    """A Pokémon as the API serves it, from the pokemon table's columns: sprite from the CDN."""
    return schemas.Pokemon.from_columns(
        {**columns, "sprite_url": cdn_sprite_url(columns["sprite_url"])}
    )


def _species(species: models.Species) -> schemas.Species:
    return schemas.Species(id=species.id, name=species.name, genus=species.genus)


def cdn_sprite_url(url: str | None) -> str | None:
    """The CDN address of a sprite hosted in PokéAPI's GitHub repo; other URLs are unchanged."""
    if url is not None and url.startswith(GITHUB_SPRITES_URL):
        return CDN_SPRITES_URL + url.removeprefix(GITHUB_SPRITES_URL)
    return url
