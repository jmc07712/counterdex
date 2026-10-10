"""Rules every stored Pokémon follows. The pokemon table enforces them, and the sync checks
them first so one bad upstream record is skipped instead of failing the whole sync."""

STAT_NAMES = ("hp", "attack", "defense", "sp_attack", "sp_defense", "speed")
MIN_BASE_STAT = 1
MAX_BASE_STAT = 255
MIN_TYPES = 1
MAX_TYPES = 2
