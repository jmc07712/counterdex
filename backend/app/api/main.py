from typing import Any

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute

from app.api.caching import NoStoreByDefault
from app.api.constants import API_PREFIX, API_TITLE, OPENAPI_URL
from app.api.cross_origin import CrossOriginProtection
from app.api.errors import ConflictError, conflict, validation_error
from app.api.routes import accounts, counter, docs, health, pokemon, sync, teams
from app.api.tags import TAG_GROUPS, TAGS


def operation_id(route: APIRoute) -> str:
    # The route function's name (list_pokemon), which generated clients turn into listPokemon().
    return route.name


class CounterdexAPI(FastAPI):
    """The app, whose OpenAPI schema also groups its tags under headings for the docs' sidebar."""

    def openapi(self) -> dict[str, Any]:
        schema = super().openapi()
        schema["x-tagGroups"] = TAG_GROUPS
        return schema


app = CounterdexAPI(
    title=API_TITLE,
    generate_unique_id_function=operation_id,
    openapi_url=OPENAPI_URL,
    # routes/docs.py serves Scalar instead of FastAPI's built-in Swagger UI and ReDoc.
    docs_url=None,
    redoc_url=None,
    exception_handlers={RequestValidationError: validation_error, ConflictError: conflict},
    openapi_tags=TAGS,
)

app.add_middleware(CrossOriginProtection)
# Added last so it wraps CrossOriginProtection, whose 403s then get no-store too.
app.add_middleware(NoStoreByDefault)

app.include_router(docs.router)
app.include_router(health.router, prefix=API_PREFIX)
app.include_router(pokemon.router, prefix=API_PREFIX)
app.include_router(sync.router, prefix=API_PREFIX)
app.include_router(accounts.router, prefix=API_PREFIX)
app.include_router(teams.router, prefix=API_PREFIX)
app.include_router(teams.members_router, prefix=API_PREFIX)
app.include_router(counter.router, prefix=API_PREFIX)
