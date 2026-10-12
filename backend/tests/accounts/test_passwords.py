import pytest
from pwdlib import PasswordHash

from app.accounts.passwords import hash_password, verify_password


@pytest.fixture(autouse=True)
def cheap_password_hashing() -> None:
    """These tests are about the real hasher, so they keep it."""


def test_hashes_with_argon2id() -> None:
    assert hash_password("pikachu1").startswith("$argon2id$")


def test_salts_every_hash() -> None:
    assert hash_password("pikachu1") != hash_password("pikachu1")


def test_only_the_right_password_matches() -> None:
    hashed = hash_password("pikachu1")

    assert verify_password("pikachu1", hashed)
    assert not verify_password("raichu12", hashed)


def test_a_missing_hash_still_costs_a_check(monkeypatch: pytest.MonkeyPatch) -> None:
    # So that no such user takes about as long as a wrong password.
    checked: list[str | bytes] = []
    real_verify = PasswordHash.verify

    def verify(self: PasswordHash, password: str | bytes, hash: str | bytes) -> bool:
        checked.append(hash)
        return real_verify(self, password, hash)

    monkeypatch.setattr(PasswordHash, "verify", verify)

    assert not verify_password("pikachu1", None)
    assert len(checked) == 1
    assert str(checked[0]).startswith("$argon2id$")
