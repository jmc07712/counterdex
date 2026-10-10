from app.accounts.types import SignedIn


def test_keeps_the_token_out_of_logs(ash: SignedIn) -> None:
    assert ash.token not in repr(ash)
