import { type Challenger, type Pokemon, Rating } from '@/api'

/** `challenger`'s matchup against the Pokémon `opponentId`, if it has one. */
export function matchupAgainst(challenger: Challenger, opponentId: number) {
  return challenger.matchups.find((matchup) => matchup.opponent_id === opponentId)
}

/** Whether `challenger` beats `opponent`: its matchup against it, from its own side, is good. */
export function beats(challenger: Challenger, opponent: Pokemon) {
  return matchupAgainst(challenger, opponent.id)?.rating === Rating.GOOD
}
