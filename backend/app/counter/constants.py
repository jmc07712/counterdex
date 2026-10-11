"""The numbers behind counter teams and threats: how a matchup is scored and rated, and how a
team is chosen.
"""

# --- Threats ---

# How many threats to a team are listed, at most.
MAX_THREATS = 12

# --- Scoring a matchup ---
# A matchup is scored from one Pokémon's side as offense + defense + power + speed. Offense is
# the points for its best attacking type's multiplier against the opponent; defense is the
# points for the opponent's best type against it, turned around. Types move the score by whole
# points and stats by fractions of one, so types decide and stats break close calls.

# An attacking type's points are log2 of its multiplier: 4x is +2, 2x +1, 1x 0, 1/2x -1 and
# 1/4x -2. A type that has no effect gets these points.
NO_EFFECT_POINTS = -3
# Points for each 100 of base stat total the Pokémon has over its opponent, or less for each
# 100 it has under.
POWER_WEIGHT = 0.25
# Points for a higher base Speed than the opponent's. A lower one takes as many off.
SPEED_POINTS = 0.25

# Scores, and the sums of them the search compares, are rounded to this many decimals: float
# arithmetic can leave scores that are equal on paper a hair apart.
SCORE_DECIMALS = 9

# --- Rating a matchup ---
# A score of at least GOOD_SCORE is good, at most BAD_SCORE bad, and anything between even. A
# type's one-point edge stays good unless the stats take more than a quarter of it back.

GOOD_SCORE = 0.75
BAD_SCORE = -0.75

# --- Choosing a team ---
# A team loses SHARED_WEAKNESS_PENALTY for each of their attacking types that at least
# SHARED_WEAKNESS_LIMIT of its Pokémon are weak to: one of theirs could beat them all.

SHARED_WEAKNESS_LIMIT = 3
SHARED_WEAKNESS_PENALTY = 1.0
