from fastapi import FastAPI

from app.api import health

app = FastAPI(
    title="Counterdex API",
    # Vercel routes only /api/* to this service, so the docs live under /api too.
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

app.include_router(health.router, prefix="/api")
