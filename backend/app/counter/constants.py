"""The numbers behind counter teams and threats: the battle model's and the search's."""

# --- Teams ---

# A team holds up to six Pokémon, as in the games.
MAX_TEAM_SIZE = 6
# How many threats to a team are listed, at most.
MAX_THREATS = 12

# --- Battle model ---
# Every Pokémon is taken at level 50, with the best individual values (31), no effort values and
# a neutral nature. The games' stat formula then gives base + STAT_BONUS for each stat but HP,
# and base + HP_BONUS for HP.

LEVEL = 50
STAT_BONUS = 20
HP_BONUS = 75

# Each Pokémon attacks with a move of this power, of one of its own types: the power of
# Flamethrower and Thunderbolt.
MOVE_POWER = 90
# A move of one of the attacker's own types does this many times the damage.
SAME_TYPE_BONUS = 1.5

# --- Search ---
# How well a Pokémon answers an opponent: its verdict's score plus a margin from 0 to 1, so a
# better verdict always scores higher.

COUNTER_SCORE = 2.0
CHECK_SCORE = 1.0
LOSS_SCORE = 0.0
# A team's second-best answer to an opponent adds this share of its score, as a backup.
BACKUP_WEIGHT = 0.25
# Taken off a team's score for each opponent that beats at least THREAT_THRESHOLD of its
# Pokémon: as much as the gap between two verdicts.
THREAT_PENALTY = 1.0
THREAT_THRESHOLD = 3
# The search stops swapping members after this many rounds, even if a swap would still help.
MAX_SWAP_ROUNDS = 20
# A swap must raise the team's score by more than this; smaller differences are rounding.
MIN_IMPROVEMENT = 1e-9
