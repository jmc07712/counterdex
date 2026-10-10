from app.accounts.passwords import hash_password, verify_password


def test_hashes_with_argon2id() -> None:
    assert hash_password("pikachu1").startswith("$argon2id$")


def test_salts_every_hash() -> None:
    assert hash_password("pikachu1") != hash_password("pikachu1")


def test_only_the_right_password_matches() -> None:
    hashed = hash_password("pikachu1")

    assert verify_password("pikachu1", hashed)
    assert not verify_password("raichu12", hashed)


def test_no_password_matches_a_missing_hash() -> None:
    assert not verify_password("pikachu1", None)
