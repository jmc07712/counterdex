from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.accounts import models


def find_user(session: Session, username: str) -> models.User | None:
    """The user with this username, whatever its case."""
    return session.scalars(
        select(models.User).where(func.lower(models.User.username) == username.lower())
    ).one_or_none()
