"""The random tokens that session cookies carry."""

import hashlib
import secrets

TOKEN_BYTES = 32


def new_token() -> str:
    return secrets.token_urlsafe(TOKEN_BYTES)


def hash_token(token: str) -> bytes:
    """What the database stores in place of the token."""
    return hashlib.sha256(token.encode()).digest()
