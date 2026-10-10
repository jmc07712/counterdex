"""Accounts as the API takes and shows them. Descriptions appear in the API docs."""

from pydantic import BaseModel, ConfigDict, Field, SecretStr

from app.accounts.constants import (
    MAX_PASSWORD_LENGTH,
    MAX_USERNAME_LENGTH,
    MIN_PASSWORD_LENGTH,
    USERNAME_PATTERN,
)


class Credentials(BaseModel):
    """A username and password, for signing in."""

    model_config = ConfigDict(use_attribute_docstrings=True)

    username: str = Field(min_length=1, max_length=MAX_USERNAME_LENGTH)
    password: SecretStr = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)


class NewAccount(Credentials):
    """A username and password, for signing up."""

    username: str = Field(pattern=USERNAME_PATTERN)
    """3 to 32 letters, digits, underscores or hyphens. Case is kept, but ignored when comparing:
    "Ash" and "ash" are the same user."""
    password: SecretStr = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)
    """8 to 128 characters."""


class User(BaseModel):
    """Someone who has signed up."""

    model_config = ConfigDict(from_attributes=True, frozen=True, use_attribute_docstrings=True)

    id: int
    username: str
    is_admin: bool
    """Whether they're an admin."""
