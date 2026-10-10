"""Constants for the Pokémon domain."""

# --- Rules every stored Pokémon follows ---
# The pokemon table enforces them, and so does the Pokemon schema: the sync skips one bad upstream
# record instead of failing the whole sync.

MIN_BASE_STAT = 1
MAX_BASE_STAT = 255
MIN_TYPES = 1
MAX_TYPES = 2

# --- Listing ---

DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200
# Cursors are Pokémon ids, which Postgres stores as 32-bit integers; anything larger can't match
# a row and would fail in the database instead of being rejected as bad input.
MAX_CURSOR = 2**31 - 1
# Longer than any Pokémon's name (27 characters at most), so no real search is cut off.
MAX_SEARCH_LENGTH = 50

# --- Sprites ---
# PokéAPI links sprites to its GitHub repo, which isn't meant for serving images to an app;
# jsDelivr serves the same files from its CDN.

GITHUB_SPRITES_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/"
CDN_SPRITES_URL = "https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/"
