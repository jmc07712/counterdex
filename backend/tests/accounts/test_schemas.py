import pytest
from pydantic import ValidationError

from app.accounts.schemas import Credentials


@pytest.mark.parametrize("username", ["ash", "Ash_Ketchum-10", "a" * 32])
def test_usernames_are_letters_digits_underscores_and_hyphens(username: str) -> None:
    Credentials(username=username, password="pikachu1")


@pytest.mark.parametrize(
    "username",
    [
        pytest.param("as", id="2-characters"),
        pytest.param("a" * 33, id="33-characters"),
        pytest.param("ash ketchum", id="space"),
        pytest.param("ash@kanto", id="symbol"),
        pytest.param("sacha-ñ", id="non-ascii"),
    ],
)
def test_rejects_other_usernames(username: str) -> None:
    with pytest.raises(ValidationError, match="username"):
        Credentials(username=username, password="pikachu1")


@pytest.mark.parametrize("password", ["pikachu", "p" * 129], ids=["7-characters", "129-characters"])
def test_passwords_are_8_to_128_characters(password: str) -> None:
    with pytest.raises(ValidationError, match="password"):
        Credentials(username="ash", password=password)


def test_keeps_the_password_out_of_logs() -> None:
    credentials = Credentials(username="ash", password="pikachu1")

    assert "pikachu1" not in repr(credentials)
    assert credentials.password.get_secret_value() == "pikachu1"
