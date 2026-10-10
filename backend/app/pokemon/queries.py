from sqlalchemy import select
from sqlalchemy.orm import Session

from app.pokemon import models, schemas
from app.pokemon.constants import CDN_SPRITES_URL, GITHUB_SPRITES_URL


def list_pokemon(session: Session, *, limit: int, cursor: int | None = None) -> schemas.PokemonPage:
    """One page of the Pokémon PokéAPI still lists, by Pokédex number, after the cursor's id."""
    query = (
        select(models.Pokemon.__table__)
        .where(models.Pokemon.removed_at.is_(None))
        .order_by(models.Pokemon.id)
    )
    if cursor is not None:
        query = query.where(models.Pokemon.id > cursor)
    # One extra row shows whether another page follows, without counting the rest.
    rows = session.execute(query.limit(limit + 1)).mappings().all()

    items = [
        schemas.Pokemon.from_columns({**row, "sprite_url": cdn_sprite_url(row["sprite_url"])})
        for row in rows[:limit]
    ]
    next_cursor = items[-1].id if len(rows) > limit else None
    return schemas.PokemonPage(items=items, next_cursor=next_cursor)


def cdn_sprite_url(url: str | None) -> str | None:
    """The CDN address of a sprite hosted in PokéAPI's GitHub repo; other URLs are unchanged."""
    if url is not None and url.startswith(GITHUB_SPRITES_URL):
        return CDN_SPRITES_URL + url.removeprefix(GITHUB_SPRITES_URL)
    return url
