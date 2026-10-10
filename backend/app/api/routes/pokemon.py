from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.api.constants import DEFAULT_PAGE_SIZE, MAX_CURSOR, MAX_PAGE_SIZE, POKEMON_CACHE_CONTROL
from app.api.dependencies import SessionDep
from app.pokemon.queries import list_pokemon
from app.pokemon.schemas import PokemonPage

router = APIRouter()


@router.get("/pokemon", summary="List Pokémon")
def get_pokemon(
    session: SessionDep,
    response: Response,
    limit: Annotated[
        int, Query(ge=1, le=MAX_PAGE_SIZE, description="How many Pokémon per page.")
    ] = DEFAULT_PAGE_SIZE,
    cursor: Annotated[
        int | None,
        Query(
            ge=1,
            le=MAX_CURSOR,
            description="Where to continue from: the previous page's `next_cursor`. "
            "Leave it out for the first page.",
        ),
    ] = None,
) -> PokemonPage:
    """Pokémon in Pokédex order, one page at a time.

    To get the next page, pass the response's `next_cursor` as `cursor`; it's `null` on the
    last page. Alternate forms, such as Mega Evolutions and regional forms, are numbered from
    10001, so they come after the main Pokédex.
    """
    response.headers["Cache-Control"] = POKEMON_CACHE_CONTROL
    return list_pokemon(session, limit=limit, cursor=cursor)
