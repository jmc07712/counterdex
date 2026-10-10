from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.api.constants import POKEMON_CACHE_CONTROL
from app.api.dependencies import SessionDep
from app.pokemon.queries import list_pokemon
from app.pokemon.schemas import PokemonPage, PokemonQuery

router = APIRouter()


@router.get("/pokemon", summary="List Pokémon")
def get_pokemon(
    session: SessionDep, response: Response, query: Annotated[PokemonQuery, Query()]
) -> PokemonPage:
    """Pokémon in Pokédex order, one page at a time, optionally filtered by name, type and form.

    To get the next page, pass the response's `next_cursor` as `cursor`, keeping the same
    filters; it's `null` on the last page. Alternate forms, such as Mega Evolutions and regional
    forms, are numbered from 10001, so they come after the main Pokédex.
    """
    response.headers["Cache-Control"] = POKEMON_CACHE_CONTROL
    return list_pokemon(session, query)
