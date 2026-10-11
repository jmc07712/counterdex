import { type Challenger, type Matchup, type Pokemon, Rating } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { formatList } from '@/lib/dates'
import { m } from '@/paraglide/messages.js'

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

// "Charizard", "Charizard and Pidgeot", "Charizard, Pidgeot and Venusaur"
function andList(items: string[]) {
  if (items.length === 1) return items[0]
  const last = items[items.length - 1]
  return m.common_list_and({ items: formatList(items.slice(0, -1)), last })
}
