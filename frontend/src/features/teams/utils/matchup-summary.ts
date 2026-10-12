import { type Challenger, type Matchup, type Pokemon, Rating } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { andList, formatList } from '@/lib/lists'
import { m } from '@/paraglide/messages.js'

import type { WeakSpots } from './weak-spots'

// Ratings from best to worst.
const BEST_FIRST: Rating[] = [Rating.GOOD, Rating.EVEN, Rating.BAD]

/**
 * Why a pick is on a counter team, from its `matchups` against `opponents`: "Strong against
 * Charizard and Pidgeot", naming those it's rated good against; failing that, those it holds its
 * own against; failing that, those it struggles against. Null without matchups.
 */
export function pickReason(matchups: Matchup[], opponents: Pokemon[]) {
  const best = bestRated(matchups, opponents)
  return best && m.team_matchup_reason({ rating: best.rating, names: andList(best.names) })
}

/**
 * What a threat does to a team, from its `matchups` against the team's `members`: "Beats
 * Charizard and Pidgeot", naming those it's rated good against; failing that, those it holds its
 * own against; failing that, those it struggles against. Null without matchups.
 */
export function threatReason(matchups: Matchup[], members: Pokemon[]) {
  const best = bestRated(matchups, members)
  return best && m.team_threat_reason({ rating: best.rating, names: andList(best.names) })
}

/**
 * What a threat that beats none of a team does instead, from its `matchups` against the team:
 * "Even with all of yours", "Even with 2 of yours, beaten by the rest", or "Beaten by all of
 * yours".
 */
export function threatWithoutWins(matchups: Matchup[]) {
  const even = matchups.filter((matchup) => matchup.rating === Rating.EVEN).length
  if (even === matchups.length) return m.team_threat_even_with_all()
  if (even > 0) return m.team_threat_even_with_some({ count: even })
  return m.team_threat_beaten_by_all()
}

/**
 * A team's weak spots in a sentence or two: "Weak spots: Charizard and Pikachu. Most of them hit
 * with Water.", or "No Pokémon of yours is beaten by half of them." if no member is exposed. The
 * type's sentence is left out without a common type.
 */
export function weakSpotsLine({ exposed, unnamed, commonType }: WeakSpots) {
  const spots =
    exposed.length === 0
      ? m.team_threats_no_weak_spots()
      : unnamed > 0
        ? m.team_threats_weak_spots_more({ names: formatList(names(exposed)), count: unnamed })
        : m.team_threats_weak_spots({ names: andList(names(exposed)) })
  if (!commonType) return spots
  const type = m.pokemon_type({ type: commonType })
  return `${spots} ${m.team_threats_common_type({ type })}`
}

/**
 * A team's threats in a sentence or two, for a screen reader: how many, and the biggest, with what
 * it does to the team's `members`. "12 threats, the biggest Garchomp. Beats Pikachu and Gengar."
 * Null without threats, or if the biggest has no matchups.
 */
export function threatsSummary(threats: Challenger[], members: Pokemon[]) {
  const [biggest] = threats
  const reason = biggest && threatReason(biggest.matchups, members)
  if (!reason) return null
  return m.team_threats_summary({
    count: threats.length,
    name: displayName(biggest.pokemon.name),
    reason,
  })
}

/**
 * Whether each of `opponents` has a pick rated good against it: "Every Pokémon on their team has
 * a good answer", or "Nothing here clearly beats Charizard", naming those that don't.
 */
export function coverage(picks: Challenger[], opponents: Pokemon[]) {
  const answered = new Set(picks.flatMap((pick) => opponentsRated(Rating.GOOD, pick.matchups)))
  const unanswered = opponents.filter((opponent) => !answered.has(opponent.id))
  if (unanswered.length === 0) return m.team_matchup_covered()
  return m.team_matchup_uncovered({ names: andList(names(unanswered)) })
}

/** The pick with the best score against the Pokémon `opponentId`, the first on a tie. */
export function bestAnswer(picks: Challenger[], opponentId: number) {
  let best: { pokemon: Pokemon; matchup: Matchup } | undefined
  for (const pick of picks) {
    const matchup = pick.matchups.find((each) => each.opponent_id === opponentId)
    if (matchup && (!best || matchup.score > best.matchup.score)) {
      best = { pokemon: pick.pokemon, matchup }
    }
  }
  return best
}

// The best rating among `matchups`, with the names of the opponents it's against, in their order.
function bestRated(matchups: Matchup[], opponents: Pokemon[]) {
  for (const rating of BEST_FIRST) {
    const ids = new Set(opponentsRated(rating, matchups))
    const rated = opponents.filter((opponent) => ids.has(opponent.id))
    if (rated.length > 0) return { rating, names: names(rated) }
  }
  return null
}

function opponentsRated(rating: Rating, matchups: Matchup[]) {
  return matchups.filter((matchup) => matchup.rating === rating).map((each) => each.opponent_id)
}

function names(pokemon: Pokemon[]) {
  return pokemon.map((each) => displayName(each.name))
}
