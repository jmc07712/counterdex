import { type Challenger, type Pokemon, type PokemonType, Rating } from '@/api'

// How many weak spots are named, at most.
const MOST_NAMED = 3

/** Where a team is weak to its threats. */
export type WeakSpots = {
  // The members that at least half of the threats beat, the most beaten first, then in battle
  // order; MOST_NAMED at most.
  exposed: Pokemon[]
  // How many more members at least half of the threats beat, past the MOST_NAMED named.
  unnamed: number
  // The type that more than half of the threats beat members with, if there is one.
  commonType: PokemonType | null
}

/**
 * Where a team with these `members`, in battle order, is weak to its `threats`. A threat beats a
 * member if its matchup against the member is rated good, from the threat's side as the API gives
 * it, and it beats members with the attack type of most of those matchups, the first on a tie.
 */
export function weakSpots(threats: Challenger[], members: Pokemon[]): WeakSpots {
  const allExposed = members
    .map((member) => ({
      member,
      beatenBy: threats.filter((threat) => beats(threat, member)).length,
    }))
    .filter(({ beatenBy }) => beatenBy > 0 && beatenBy * 2 >= threats.length)
    // Sorting is stable, so members beaten by as many stay in battle order.
    .sort((a, b) => b.beatenBy - a.beatenBy)
  const common = mostCommon(threats.flatMap((threat) => attackType(threat) ?? []))
  return {
    exposed: allExposed.slice(0, MOST_NAMED).map(({ member }) => member),
    unnamed: Math.max(allExposed.length - MOST_NAMED, 0),
    commonType: common && common.count * 2 > threats.length ? common.item : null,
  }
}

/** Whether `threat` beats `member`: its matchup against the member, from its own side, is good. */
export function beats(threat: Challenger, member: Pokemon) {
  return threat.matchups.some(
    (matchup) => matchup.opponent_id === member.id && matchup.rating === Rating.GOOD,
  )
}

// The type a threat beats members with; undefined if it beats none.
function attackType(threat: Challenger) {
  const wins = threat.matchups.filter((matchup) => matchup.rating === Rating.GOOD)
  return mostCommon(wins.map((matchup) => matchup.attack.type))?.item
}

// The item that appears most in `items`, the first on a tie, and how many times; undefined if
// there are none.
function mostCommon<T>(items: T[]) {
  const counts = new Map<T, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  let most: { item: T; count: number } | undefined
  for (const [item, count] of counts) {
    if (!most || count > most.count) most = { item, count }
  }
  return most
}
