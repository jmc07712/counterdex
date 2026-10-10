import pytest
from pydantic import ValidationError

from app.accounts.schemas import Credentials, NewAccount

# --- Signing up ---


@pytest.mark.parametrize("username", ["ash", "Ash_Ketchum-10", "a" * 32])
def test_usernames_are_letters_digits_underscores_and_hyphens(username: str) -> None:
    NewAccount(username=username, password="pikachu1")


@pytest.mark.parametrize(
    "username",
    [
        pytest.param("as", id="2-characters"),
        pytest.param("a" * 33, id="33-characters"),
        pytest.param("ash ketchum", id="space"),
        pytest.param("ash@kanto", id="symbol"),
        pytest.param("sacha-ñ", id="non-ascii"),
        pytest.param("ash\n", id="trailing-newline"),
    ],
)
def test_rejects_other_usernames(username: str) -> None:
    with pytest.raises(ValidationError, match="username"):
        NewAccount(username=username, password="pikachu1")


@pytest.mark.parametrize("password", ["pikachu", "p" * 129], ids=["7-characters", "129-characters"])
def test_passwords_are_8_to_128_characters(password: str) -> None:
    with pytest.raises(ValidationError, match="password"):
        NewAccount(username="ash", password=password)


# --- Signing in ---


def test_signing_in_takes_any_username_and_password() -> None:
    # The sign-up rules aren't checked, so a guess that breaks them is just a wrong guess.
    Credentials(username="ash ketchum", password="pikachu")


@pytest.mark.parametrize(
    ("username", "password"),
    [
        pytest.param("", "pikachu1", id="no-username"),
        pytest.param("ash", "", id="no-password"),
        pytest.param("a" * 33, "pikachu1", id="username-longer-than-any"),
        pytest.param("ash", "p" * 129, id="password-longer-than-any"),
    ],
)
def test_signing_in_needs_a_username_and_password_that_could_exist(
    username: str, password: str
) -> None:
    with pytest.raises(ValidationError):
        Credentials(username=username, password=password)


def test_keeps_the_password_out_of_logs() -> None:
    credentials = Credentials(username="ash", password="pikachu1")

    assert "pikachu1" not in repr(credentials)
    assert credentials.password.get_secret_value() == "pikachu1"
