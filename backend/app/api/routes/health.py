from fastapi import APIRouter

from app.api.tags import HEALTH

router = APIRouter(tags=[HEALTH])


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
