from sqlalchemy import ColumnElement, func, select
from sqlalchemy.orm import Session

from app.accounts import models


def has_username(username: str) -> ColumnElement[bool]:
    """Whether a user has this username, whatever its case. It compares what USERNAME_INDEX
    indexes, so Postgres can look the user up with it.
    """
    return func.lower(models.User.username) == username.lower()


def find_user(session: Session, username: str) -> models.User | None:
    """The user with this username, whatever its case."""
    return session.scalars(select(models.User).where(has_username(username))).one_or_none()
