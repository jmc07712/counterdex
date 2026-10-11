import {
  type Challenger,
  type Matchup,
  type Pokemon,
  PokemonType,
  Rating,
  RelativeSpeed,
} from '@/api'

/**
 * A matchup against the Pokémon `opponent_id`, as the API gives one: by default an even one, with
 * Normal moves neutral both ways, equal Speed and equal base stat totals.
 */
export function makeMatchup(overrides: Partial<Matchup> & Pick<Matchup, 'opponent_id'>): Matchup {
  return {
    attack: { type: PokemonType.NORMAL, multiplier: 1 },
    opponent_attack: { type: PokemonType.NORMAL, multiplier: 1 },
    speed: RelativeSpeed.TIED,
    stat_total_difference: 0,
    score: 0,
    rating: Rating.EVEN,
    ...overrides,
  }
}

/** `pokemon` with a matchup rated each of `ratings` against each of `opponents`, in order. */
export function makeChallenger(
  pokemon: Pokemon,
  opponents: Pokemon[],
  ratings: Rating[],
): Challenger {
  return {
    pokemon,
    matchups: opponents.map((opponent, index) => {
      const rating = ratings[index]
      return makeMatchup({ opponent_id: opponent.id, rating, score: SCORES[rating] })
    }),
  }
}

// A score each rating could have come from.
const SCORES: Record<Rating, number> = { good: 1, even: 0, bad: -1 }
