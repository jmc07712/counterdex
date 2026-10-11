from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute

from app.api.constants import API_PREFIX, API_TITLE, OPENAPI_URL
from app.api.cross_origin import CrossOriginProtection
from app.api.errors import validation_error
from app.api.routes import accounts, docs, health, pokemon, sync, teams


def operation_id(route: APIRoute) -> str:
    # The route function's name (list_pokemon), which generated clients turn into listPokemon().
    return route.name


app = FastAPI(
    title=API_TITLE,
    generate_unique_id_function=operation_id,
    openapi_url=OPENAPI_URL,
    # routes/docs.py serves Scalar instead of FastAPI's built-in Swagger UI and ReDoc.
    docs_url=None,
    redoc_url=None,
    exception_handlers={RequestValidationError: validation_error},
)

app.add_middleware(CrossOriginProtection)

app.include_router(docs.router)
app.include_router(health.router, prefix=API_PREFIX)
app.include_router(pokemon.router, prefix=API_PREFIX)
app.include_router(sync.router, prefix=API_PREFIX)
app.include_router(accounts.router, prefix=API_PREFIX)
app.include_router(teams.router, prefix=API_PREFIX)
