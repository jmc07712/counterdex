"""Choosing a counter team, ordering it for battle, and ranking the threats to a team, from
scored matchups.
"""

import math
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Self

from app.counter.constants import (
    SCORE_DECIMALS,
    SHARED_WEAKNESS_LIMIT,
    SHARED_WEAKNESS_PENALTY,
)
from app.counter.types import Contender
from app.pokemon.enums import PokemonType


def team_score(team: Sequence[Contender]) -> float:
    """How well a team of at least one Pokémon answers theirs: its best score against each of
    their Pokémon, added up, less SHARED_WEAKNESS_PENALTY for each of their attacking types that
    SHARED_WEAKNESS_LIMIT or more of the team are weak to.
    """
    standing = _Standing.empty(len(team[0].matchups))
    for member in team:
        standing = standing.adding(member)
    return standing.score()


@dataclass(frozen=True)
class _Standing:
    """What a team's score is worked out from: its best score against each of their Pokémon,
    and how many of its Pokémon are weak to each of their attacking types.
    """

    best: tuple[float, ...]
    weak: Counter[PokemonType]

    @classmethod
    def empty(cls, opponents: int) -> Self:
        return cls((-math.inf,) * opponents, Counter())

    def adding(self, contender: Contender) -> Self:
        best = tuple(
            max(score, matchup.score)
            for score, matchup in zip(self.best, contender.matchups, strict=True)
        )
        return type(self)(best, self.weak + Counter(contender.weak_to))

    def score(self) -> float:
        shared = sum(1 for count in self.weak.values() if count >= SHARED_WEAKNESS_LIMIT)
        return round(sum(self.best) - SHARED_WEAKNESS_PENALTY * shared, SCORE_DECIMALS)


def counter_team(contenders: Sequence[Contender], size: int) -> list[Contender]:
    """`size` of the contenders, one from each evolution family, in battle order. There must be
    at least `size` families among them.

    They're chosen one at a time: each is the contender that raises team_score most. Ties go to
    the higher total score against their Pokémon, then the higher base stat total, then the
    lower id.
    """
    team: list[Contender] = []
    standing = _Standing.empty(len(contenders[0].matchups))
    for _ in range(size):
        choice = _best_addition(contenders, team, standing)
        team.append(choice)
        standing = standing.adding(choice)
    return battle_order(team)


def _best_addition(
    contenders: Sequence[Contender], team: Sequence[Contender], standing: _Standing
) -> Contender:
    """The contender, from a family not on the team, that raises its score most, with ties
    going as counter_team says.
    """
    families = {member.candidate.family_id for member in team}
    return max(
        (each for each in contenders if each.candidate.family_id not in families),
        key=lambda each: (standing.adding(each).score(), *_strength(each)),
    )


def _strength(contender: Contender) -> tuple[float, int, int]:
    """How a contender ranks among equals, highest first: by its total score against their
    Pokémon, then its base stat total, then the lower id.
    """
    profile = contender.candidate.profile
    total = round(sum(matchup.score for matchup in contender.matchups), SCORE_DECIMALS)
    return total, profile.stat_total, -profile.id


def battle_order(team: Sequence[Contender]) -> list[Contender]:
    """The team in the order to send it out: first the Pokémon with the best score against
    their lead (their first Pokémon), then the rest in the order of the opponents they each
    score best against (the first, on a tie). Ties go as counter_team says.
    """
    lead = max(team, key=lambda member: (member.matchups[0].score, *_strength(member)))
    strongest_first = sorted(
        (member for member in team if member is not lead), key=_strength, reverse=True
    )
    return [lead, *sorted(strongest_first, key=_best_answered)]


def _best_answered(member: Contender) -> int:
    """The position, in their team, of the opponent the Pokémon scores best against."""
    scores = [matchup.score for matchup in member.matchups]
    return scores.index(max(scores))


def threats(contenders: Sequence[Contender], limit: int) -> list[Contender]:
    """Up to `limit` of the contenders with the highest total score against the team, only the
    best of each evolution family. Ties go as counter_team says.
    """
    chosen: list[Contender] = []
    families: set[int] = set()
    for contender in sorted(contenders, key=_strength, reverse=True):
        if len(chosen) == limit:
            break
        if contender.candidate.family_id not in families:
            families.add(contender.candidate.family_id)
            chosen.append(contender)
    return chosen
