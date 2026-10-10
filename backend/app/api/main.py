from fastapi import FastAPI

from app.api.constants import API_PREFIX, API_TITLE, OPENAPI_URL
from app.api.routes import docs, health, pokemon

app = FastAPI(
    title=API_TITLE,
    openapi_url=OPENAPI_URL,
    # routes/docs.py serves Scalar instead of FastAPI's built-in Swagger UI and ReDoc.
    docs_url=None,
    redoc_url=None,
)

app.include_router(docs.router)
app.include_router(health.router, prefix=API_PREFIX)
app.include_router(pokemon.router, prefix=API_PREFIX)
