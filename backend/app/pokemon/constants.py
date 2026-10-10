"""Constants for the Pokémon domain."""

from datetime import timedelta

from app.pokemon.enums import PokemonForm

# --- Rules every stored Pokémon follows ---
# The pokemon table enforces them, and so does the Pokemon schema: the sync skips one bad upstream
# record instead of failing the whole sync.

MIN_BASE_STAT = 1
MAX_BASE_STAT = 255
MIN_TYPES = 1
MAX_TYPES = 2

# --- Alternate forms ---
# PokéAPI names a form after its kind (charizard-mega-x, raichu-alola); the first marker found
# in an alternate form's name decides it, and anything else is PokemonForm.OTHER.

FORM_MARKERS = {
    "mega": PokemonForm.MEGA,
    "gmax": PokemonForm.GIGANTAMAX,
    "alola": PokemonForm.ALOLAN,
    "galar": PokemonForm.GALARIAN,
    "hisui": PokemonForm.HISUIAN,
    "paldea": PokemonForm.PALDEAN,
}

# --- Listing ---

# How long after a sync changes a Pokémon it counts as recently changed.
RECENTLY_CHANGED = timedelta(days=7)

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200
# Postgres stores Pokémon ids as 32-bit integers. A larger id (or cursor, which is an id) can't
# match a row and would fail in the database instead of being rejected as bad input.
MAX_POKEMON_ID = 2**31 - 1
# Longer than any Pokémon's name (27 characters at most), so no real search is cut off.
MAX_SEARCH_LENGTH = 50

# --- Sprites ---
# PokéAPI links sprites to its GitHub repo, which isn't meant for serving images to an app;
# jsDelivr serves the same files from its CDN.

GITHUB_SPRITES_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/"
CDN_SPRITES_URL = "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/"
