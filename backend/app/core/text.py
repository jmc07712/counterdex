"""Rules for text the API takes in."""

from pydantic import AfterValidator


def _refuse_nul(text: str) -> str:
    if "\x00" in text:
        raise ValueError("Text can't contain the NUL character (U+0000).")
    return text


# Refuses text with a NUL character, which Postgres can't store or compare. Put it after a str's
# other constraints in an Annotated type, so they run first.
NO_NUL = AfterValidator(_refuse_nul)
