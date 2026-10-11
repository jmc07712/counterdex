"""Choosing a counter team, ordering it for battle, and ranking the threats to a team, from the
exchanges the battle model works out.
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Self

from app.counter.constants import (
    BACKUP_WEIGHT,
    CHECK_SCORE,
    COUNTER_SCORE,
    LOSS_SCORE,
    MAX_SWAP_ROUNDS,
    MIN_IMPROVEMENT,
    THREAT_PENALTY,
    THREAT_THRESHOLD,
)
from app.counter.enums import Verdict
from app.counter.types import Contender, Exchange


def answer_score(exchange: Exchange) -> float:
    """How well a Pokémon answers an opponent: its verdict's score plus its margin. A counter
    or check scores more the more of its HP it has left; a loss scores more the less of the
    opponent's HP is left.
    """
    match exchange.verdict:
        case Verdict.COUNTER:
            return COUNTER_SCORE + exchange.hp_left
        case Verdict.CHECK:
            return CHECK_SCORE + exchange.hp_left
        case Verdict.LOSES:
            return LOSS_SCORE + 1 - exchange.hp_left


def lead_score(exchange: Exchange) -> float:
    """How well a Pokémon answers an opponent when both are sent out together: from a neutral
    start, so a check is as good as a counter, by how much HP it has left.
    """
    if exchange.neutral_hp_left is None:
        return answer_score(exchange)
    return CHECK_SCORE + exchange.neutral_hp_left


def team_score(team: Sequence[Contender]) -> float:
    """How well a team answers the opponents, which the search makes as high as it can.

    For each opponent: the team's best answer score, plus BACKUP_WEIGHT of its second best, less
    THREAT_PENALTY if the opponent beats THREAT_THRESHOLD or more of the team.
    """
    opponents = len(team[0].exchanges) if team else 0
    return _Columns.of(team, opponents).score()


@dataclass(frozen=True)
class _Row:
    """A contender's answer score against each opponent, and whether it loses to each."""

    scores: tuple[float, ...]
    loses: tuple[int, ...]

    @classmethod
    def of(cls, contender: Contender) -> Self:
        return cls(
            tuple(answer_score(each) for each in contender.exchanges),
            tuple(int(each.verdict is Verdict.LOSES) for each in contender.exchanges),
        )


@dataclass(frozen=True)
class _Columns:
    """A team's standing against each opponent: its best and second-best answer scores, and how
    many of its Pokémon lose.
    """

    best: tuple[float, ...]
    second: tuple[float, ...]
    losses: tuple[int, ...]

    @classmethod
    def of(cls, team: Sequence[Contender], opponents: int) -> Self:
        best, second, losses = [0.0] * opponents, [0.0] * opponents, [0] * opponents
        for row in (_Row.of(member) for member in team):
            for index, (score, loses) in enumerate(zip(row.scores, row.loses, strict=True)):
                best[index], second[index] = _top_two(best[index], second[index], score)
                losses[index] += loses
        return cls(tuple(best), tuple(second), tuple(losses))

    def score(self) -> float:
        return sum(
            _opponent_score(top, runner_up, lost)
            for top, runner_up, lost in zip(self.best, self.second, self.losses, strict=True)
        )

    def score_adding(self, row: _Row) -> float:
        """The team's score with the row's Pokémon added."""
        columns = zip(self.best, self.second, self.losses, row.scores, row.loses, strict=True)
        return sum(
            _opponent_score(*_top_two(top, runner_up, score), lost + loses)
            for top, runner_up, lost, score, loses in columns
        )


def _top_two(best: float, second: float, score: float) -> tuple[float, float]:
    """The best and second-best scores once `score` joins them."""
    if score > best:
        return score, best
    return best, max(second, score)


def _opponent_score(best: float, second: float, losses: int) -> float:
    """A team's score against one opponent (see team_score)."""
    penalty = THREAT_PENALTY if losses >= THREAT_THRESHOLD else 0.0
    return best + BACKUP_WEIGHT * second - penalty


def counter_team(contenders: Sequence[Contender], size: int) -> list[Contender]:
    """The team of `size` contenders with the highest team_score, one from each evolution
    family, in battle order. There must be at least `size` families among the contenders.

    The team is built greedily, adding the contender that raises its score most, then improved
    by swaps: each round makes the one swap of a member for a contender that raises the score
    most, until none does or MAX_SWAP_ROUNDS have run. Ties go to the lowest id.
    """
    pool = sorted(contenders, key=_id)
    rows = [_Row.of(each) for each in pool]
    opponents = len(rows[0].scores)
    team: list[int] = []
    for _ in range(size):
        columns = _Columns.of([pool[index] for index in team], opponents)
        team.append(_best_addition(pool, rows, team, columns)[0])

    score = team_score([pool[index] for index in team])
    for _ in range(MAX_SWAP_ROUNDS):
        swap = _best_swap(pool, rows, team)
        if swap is None or swap[2] <= score + MIN_IMPROVEMENT:
            break
        position, index, score = swap
        team[position] = index
    return battle_order([pool[index] for index in team])


def _best_addition(
    pool: Sequence[Contender], rows: Sequence[_Row], team: Sequence[int], columns: _Columns
) -> tuple[int, float]:
    """The contender (by its index in the pool) whose addition raises the team's score most,
    from a family not on the team, with the score it gives; the first of equals.
    """
    families = {pool[index].candidate.family_id for index in team}
    best_index, best_score = -1, float("-inf")
    for index, (contender, row) in enumerate(zip(pool, rows, strict=True)):
        if contender.candidate.family_id in families:
            continue
        score = columns.score_adding(row)
        if score > best_score:
            best_index, best_score = index, score
    return best_index, best_score


def _best_swap(
    pool: Sequence[Contender], rows: Sequence[_Row], team: Sequence[int]
) -> tuple[int, int, float] | None:
    """The swap that gives the team the highest score, as (the member's position, the
    contender's index in the pool, the score); the first of equals. None if there's no
    contender to swap in.
    """
    best: tuple[int, int, float] | None = None
    for position in range(len(team)):
        others = [index for at, index in enumerate(team) if at != position]
        columns = _Columns.of([pool[other] for other in others], len(rows[0].scores))
        index, score = _best_addition(pool, rows, others, columns)
        # The best addition can be the member it would replace: no swap there helps.
        if index != -1 and index not in team and (best is None or score > best[2]):
            best = (position, index, score)
    return best


def battle_order(team: Sequence[Contender]) -> list[Contender]:
    """The team in the order to send it out.

    The lead is the Pokémon that best answers their lead (their first Pokémon) by lead_score:
    leads come out together, so a check is enough. The rest follow in the order of the opponents
    they each answer best (the first, on a tie). Ties go to the lowest id.
    """
    lead = max(team, key=lambda member: (lead_score(member.exchanges[0]), -_id(member)))
    rest = sorted(
        (member for member in team if member is not lead),
        key=lambda member: (_best_answered(member), _id(member)),
    )
    return [lead, *rest]


def _best_answered(member: Contender) -> int:
    """The position, in their team, of the opponent the Pokémon answers best."""
    scores = [answer_score(each) for each in member.exchanges]
    return scores.index(max(scores))


def threats(contenders: Sequence[Contender], limit: int) -> list[Contender]:
    """Up to `limit` of the contenders that beat the most of the team, as a counter or check:
    most first, then by the sum of the margins they beat them by, then by the lowest id.
    Contenders that beat none of the team are left out.
    """
    ranked = []
    for contender in contenders:
        wins = [each.hp_left for each in contender.exchanges if each.verdict is not Verdict.LOSES]
        if wins:
            ranked.append(((-len(wins), -sum(wins), _id(contender)), contender))
    ranked.sort(key=lambda entry: entry[0])
    return [contender for _, contender in ranked[:limit]]


def _id(contender: Contender) -> int:
    return contender.candidate.fighter.id
