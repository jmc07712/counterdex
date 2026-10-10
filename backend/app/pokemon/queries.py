from sqlalchemy import select
from sqlalchemy.orm import Session

from app.pokemon import models, schemas
from app.pokemon.constants import CDN_SPRITES_URL, GITHUB_SPRITES_URL
from app.pokemon.enums import FormFilter


def list_pokemon(session: Session, query: schemas.PokemonQuery) -> schemas.PokemonPage:
    """One page of the matching Pokémon PokéAPI still lists, by Pokédex number, after the cursor."""
    statement = (
        select(models.Pokemon.__table__)
        .where(models.Pokemon.removed_at.is_(None))
        .order_by(models.Pokemon.id)
    )
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

    items = [
        schemas.Pokemon.from_columns({**row, "sprite_url": cdn_sprite_url(row["sprite_url"])})
        for row in rows[: query.limit]
    ]
    next_cursor = items[-1].id if len(rows) > query.limit else None
    return schemas.PokemonPage(items=items, next_cursor=next_cursor)


def cdn_sprite_url(url: str | None) -> str | None:
    """The CDN address of a sprite hosted in PokéAPI's GitHub repo; other URLs are unchanged."""
    if url is not None and url.startswith(GITHUB_SPRITES_URL):
        return CDN_SPRITES_URL + url.removeprefix(GITHUB_SPRITES_URL)
    return url
