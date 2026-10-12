"""Signing up, signing in and signing out, and making users admins.

Nothing here commits: the caller owns the transaction.
"""

from datetime import UTC, datetime

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.accounts import models
from app.accounts.constants import RENEW_SESSIONS_WITHIN, SESSION_LIFETIME
from app.accounts.exceptions import UsernameTakenError, UserNotFoundError
from app.accounts.passwords import hash_password, verify_password
from app.accounts.schemas import Credentials, NewAccount, User
from app.accounts.tokens import hash_token, new_token
from app.accounts.types import SignedIn
from app.core.db import violates_unique


def sign_up(session: Session, account: NewAccount) -> SignedIn:
    """Creates an account and signs it in.

    Raises UsernameTakenError if someone has the username, whatever its case.
    """
    user = models.User(
        username=account.username,
        password_hash=hash_password(account.password.get_secret_value()),
    )
    try:
        # In a savepoint, so a taken username doesn't abort the caller's transaction.
        with session.begin_nested():
            session.add(user)
    except IntegrityError as error:
        if violates_unique(error, models.USERNAME_INDEX.name):
            raise UsernameTakenError(account.username) from error
        raise
    return _start_session(session, user)


def sign_in(session: Session, credentials: Credentials) -> SignedIn | None:
    """Starts a session if the password is right, or returns None.

    A wrong username and a wrong password return the same thing.
    """
    password = credentials.password.get_secret_value()
    user = _find_user(session, credentials.username)
    if user is None:
        verify_password(password, None)
        return None
    if not verify_password(password, user.password_hash):
        return None

    # Expired sessions aren't deleted anywhere else.
    session.execute(
        delete(models.UserSession).where(
            models.UserSession.user_id == user.id,
            models.UserSession.expires_at <= datetime.now(UTC),
        )
    )
    return _start_session(session, user)


def find_signed_in(session: Session, token: str) -> SignedIn | None:
    """Who `token` signs in, or None if it isn't a current session's.

    A session used in the second half of its life is renewed for a full one.
    """
    now = datetime.now(UTC)
    current = (
        models.UserSession.token_hash == hash_token(token),
        models.UserSession.expires_at > now,
    )
    row = session.execute(
        select(models.User, models.UserSession.expires_at).join(models.UserSession).where(*current)
    ).one_or_none()
    if row is None:
        return None

    user, expires_at = row
    if expires_at - now < RENEW_SESSIONS_WITHIN:
        # One statement, so a sign-out since the select leaves no row to renew.
        renewed: datetime | None = session.scalar(
            update(models.UserSession)
            .where(*current)
            .values(expires_at=now + SESSION_LIFETIME)
            .returning(models.UserSession.expires_at)
        )
        if renewed is None:
            return None
        expires_at = renewed
    return SignedIn(User.model_validate(user), token, expires_at)


def sign_out(session: Session, token: str) -> None:
    """Ends the session `token` signs in, if there is one. The user's other sessions go on."""
    session.execute(
        delete(models.UserSession).where(models.UserSession.token_hash == hash_token(token))
    )


def set_admin(session: Session, username: str, is_admin: bool) -> User:
    """Makes the user an admin, or takes that away, and returns them as they are now.

    The username's case doesn't matter. Raises UserNotFoundError if no one has it.
    """
    user = _find_user(session, username)
    if user is None:
        raise UserNotFoundError(username)
    user.is_admin = is_admin
    session.flush()
    return User.model_validate(user)


def _find_user(session: Session, username: str) -> models.User | None:
    """The user with this username, whatever its case."""
    return session.scalars(
        select(models.User).where(func.lower(models.User.username) == username.lower())
    ).one_or_none()


def _start_session(session: Session, user: models.User) -> SignedIn:
    token = new_token()
    expires_at = datetime.now(UTC) + SESSION_LIFETIME
    session.add(
        models.UserSession(token_hash=hash_token(token), user_id=user.id, expires_at=expires_at)
    )
    session.flush()
    return SignedIn(User.model_validate(user), token, expires_at)
