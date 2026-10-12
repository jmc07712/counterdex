"""The numbers behind counter teams and threats, which say how a matchup is scored and rated, and
how a team is chosen.

The numbers are picked by hand, not fitted to battle results, because the Pokédex has no moves
and so there's no battle data to fit them to. Each one follows a simple rule. Types decide most
matchups, stats break near-ties, and a matchup scores the same from either side, turned around.
Each was then checked against the real Pokédex. The figures quoted below come from the 1,024
default forms synced in October 2026. The frontend's How it works text repeats these numbers, so
change both together.
"""

# --- Threats ---

# How many threats to a team are listed, at most. Twelve is two teams' worth, enough for a weak
# spot to show up as a pattern, and few enough that the grid of threats against members stays
# easy to read.
MAX_THREATS = 12

# --- Scoring a matchup ---
# A matchup is scored from one Pokémon's side as offense + defense + power + speed. Offense is
# the points for its best attacking type against the opponent. Defense is the points for the
# opponent's best type against it, taken away. Types move the score by whole points. Stats move it
# by POWER_WEIGHT for each STAT_TOTAL_STEP of base stat total between the two, so a big enough
# gap can outweigh a type, and Speed moves it by SPEED_POINTS.
#
# With no moves in the data, a Pokémon is assumed to attack with its own types. Both Pokémon
# attack, so a matchup counts the opponent's best type against it as much as its own. And because
# every part is turned around for the other side, the opponent's score is always the exact
# opposite. So threats (the best Pokémon against a team) and counters (the best against theirs)
# come from the same scoring, seen from opposite sides.

# An attacking type's points are log2 of its multiplier, so 4x is +2, 2x +1, 1x 0, 1/2x -1 and
# 1/4x -2. Multipliers multiply (a dual type that's weak twice takes 2 x 2 = 4x), and log2 turns
# that into steps that add up. A double weakness counts twice, and a resistance cancels out a
# weakness. A type that has no effect gets NO_EFFECT_POINTS. That's one step worse than 1/4x,
# because an immunity is worse than any resistance, but not so bad that one immunity outweighs
# the rest of a team's score.
NO_EFFECT_POINTS = -3
# Power is +POWER_WEIGHT for each STAT_TOTAL_STEP of base stat total the Pokémon has over its
# opponent, and -POWER_WEIGHT for each it has under, counted in parts of a step too.
#
# A quarter point per 100 keeps types in charge. Base stat totals run from 175 to 720. Half of
# all pairs of Pokémon differ by less than 110 (about 0.27 points), and 90% by less than 263
# (about 0.66). So a gap only cancels a whole type step when it's 400 or more, in 0.6% of pairs.
# Stats still decide between Pokémon with the same type edge, and a big enough gap turns a type
# edge from good to even. The total stands in for strength because, without moves, there's no way
# to know which attack stat a Pokémon would use.
STAT_TOTAL_STEP = 100
POWER_WEIGHT = 0.25
# Speed is +SPEED_POINTS for a higher base Speed than the opponent's, -SPEED_POINTS for a lower
# one, and 0 for the same. Going first matters, but here it's only faster or slower, so it counts
# the same as a 100-point stat gap and much less than a type step. Ties are rare, at 2.5% of pairs.
SPEED_POINTS = 0.25

# Scores, and the sums of them the search compares, are rounded to this many decimals. Float
# arithmetic can leave scores that are equal on paper a hair apart.
SCORE_DECIMALS = 9

# --- Rating a matchup ---
# A score of at least GOOD_SCORE is good, at most BAD_SCORE bad, and anything between even.
#
# 0.75 is three quarters of a type step. So a clear type advantage still rates good when the
# opponent has up to 100 more stat points and they're equally fast (200 more if it's faster, and
# none if it's slower). Without a type advantage, a Pokémon needs 200 more stat points and to be
# faster to rate good, or 300 more if they're equally fast. The cut-offs are the same distance
# either side of zero, so turning a matchup around turns good into bad and back. That's how the
# threats grid rates each threat from the member's side.

GOOD_SCORE = 0.75
BAD_SCORE = -0.75

# --- Choosing a team ---
# A team loses SHARED_WEAKNESS_PENALTY for each of their attacking types that at least
# SHARED_WEAKNESS_LIMIT of its Pokémon are weak to, since one of theirs could beat them all.
#
# Three is half a team, so from there one opponent of that type threatens half the counter or
# more. The penalty counts as much as a type step. So the search takes a slightly weaker pick that
# doesn't share the weakness, but still takes a clearly better one that does.

SHARED_WEAKNESS_LIMIT = 3
SHARED_WEAKNESS_PENALTY = 1.0
