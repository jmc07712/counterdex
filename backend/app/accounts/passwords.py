"""Password hashing with argon2id."""

from functools import cache

from pwdlib import PasswordHash

_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str | None) -> bool:
    """Whether `password` matches `hashed`.

    With no hash (no such user), it verifies against a stand-in hash and returns False, so a
    wrong username takes about as long as a wrong password.
    """
    if hashed is None:
        _hasher.verify(password, _stand_in_hash())
        return False
    return _hasher.verify(password, hashed)


@cache
def _stand_in_hash() -> str:
    # Hashed on first use rather than at import.
    return _hasher.hash("not anyone's password")
