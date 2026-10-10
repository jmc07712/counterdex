"""Password hashing with argon2id."""

from pwdlib import PasswordHash

_hasher = PasswordHash.recommended()
# Checked against when there's no such user; see verify_password.
_STAND_IN_HASH = _hasher.hash("not anyone's password")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, hashed: str | None) -> bool:
    """Whether `password` matches `hashed`.

    With no hash (no such user), it verifies against a stand-in hash and returns False, so a
    wrong username takes about as long as a wrong password.
    """
    if hashed is None:
        _hasher.verify(password, _STAND_IN_HASH)
        return False
    return _hasher.verify(password, hashed)
