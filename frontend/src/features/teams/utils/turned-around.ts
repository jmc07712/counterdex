import { type Matchup, Rating, RelativeSpeed } from '@/api'

// Each rating as the other side has it.
const TURNED_RATINGS: Record<Rating, Rating> = {
  [Rating.GOOD]: Rating.BAD,
  [Rating.EVEN]: Rating.EVEN,
  [Rating.BAD]: Rating.GOOD,
}

// Each relative Speed as the other side has it.
const TURNED_SPEEDS: Record<RelativeSpeed, RelativeSpeed> = {
  [RelativeSpeed.FASTER]: RelativeSpeed.SLOWER,
  [RelativeSpeed.TIED]: RelativeSpeed.TIED,
  [RelativeSpeed.SLOWER]: RelativeSpeed.FASTER,
}

/**
 * `matchup`, a Pokémon's against an opponent, from the opponent's side: the opponent's matchup
 * against the Pokémon `opponentId`. The API scores the other side of a matchup as the opposite
 * score, and its ratings' thresholds are as far above even as below, so this is the matchup it
 * would give for that side.
 */
export function turnedAround(matchup: Matchup, opponentId: number): Matchup {
  return {
    opponent_id: opponentId,
    attack: matchup.opponent_attack,
    opponent_attack: matchup.attack,
    speed: TURNED_SPEEDS[matchup.speed],
    stat_total_difference: -matchup.stat_total_difference,
    score: -matchup.score,
    rating: TURNED_RATINGS[matchup.rating],
  }
}
