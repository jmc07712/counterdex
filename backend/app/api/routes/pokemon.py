from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, Response, status

from app.api.caching import cache_publicly
from app.api.constants import POKEMON_CACHE_CONTROL
from app.api.dependencies import SessionDep
from app.api.tags import POKEMON
from app.pokemon import queries
from app.pokemon.constants import MAX_POKEMON_ID
from app.pokemon.schemas import PokemonDetails, PokemonPage, PokemonQuery
from app.sync import queries as sync_queries
from app.sync.schemas import PokemonChange

router = APIRouter(tags=[POKEMON])


@router.get("/pokemon", summary="List Pokémon")
def list_pokemon(
    session: SessionDep, response: Response, query: Annotated[PokemonQuery, Query()]
) -> PokemonPage:
    """Pokémon in Pokédex order, one page at a time, optionally filtered by name, type and form,
    and by whether PokéAPI still lists them.

    To get the next page, pass the response's `next_cursor` as `cursor`, keeping the same
    filters; it's `null` on the last page. Alternate forms, such as Mega Evolutions and regional
    forms, are numbered from 10001, so they come after the main Pokédex.
    """
    cache_publicly(response, POKEMON_CACHE_CONTROL)
    return queries.list_pokemon(session, query)


PokemonId = Annotated[
    int, Path(ge=1, le=MAX_POKEMON_ID, description="The Pokémon's `id`, e.g. 6 or 10034.")
]
NOT_FOUND = "No Pokémon has this id."


@router.get(
    "/pokemon/{pokemon_id}",
    summary="Get a Pokémon",
    responses={status.HTTP_404_NOT_FOUND: {"description": NOT_FOUND}},
)
def get_pokemon(session: SessionDep, response: Response, pokemon_id: PokemonId) -> PokemonDetails:
    """A Pokémon with its species, the species' other forms, and its evolution family.

    Pokémon that PokéAPI no longer lists can still be fetched: `removed_at` says when they were
    removed.
    """
    details = queries.get_pokemon_details(session, pokemon_id)
    if details is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    cache_publicly(response, POKEMON_CACHE_CONTROL)
    return details


@router.get(
    "/pokemon/{pokemon_id}/changes",
    summary="List a Pokémon's changes",
    responses={status.HTTP_404_NOT_FOUND: {"description": NOT_FOUND}},
)
def list_pokemon_changes(
    session: SessionDep, response: Response, pokemon_id: PokemonId
) -> list[PokemonChange]:
    """Every change a sync has found to the Pokémon, newest first: updates to its data, and
    PokéAPI removing it or listing it again. A Pokémon is new to the Pokédex without a change.
    """
    if not queries.pokemon_exists(session, pokemon_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    cache_publicly(response, POKEMON_CACHE_CONTROL)
    return sync_queries.list_pokemon_changes(session, pokemon_id)
