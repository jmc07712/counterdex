import type { Attack, Matchup, Pokemon } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { m } from '@/paraglide/messages.js'

// A gap of 100 in base stat totals moves a score a quarter point, as much as being faster does.
// Smaller gaps are left out of the sentence.
const STAT_GAP_WORTH_SAYING = 100

/** A type multiplier in words: "4×", "2×", "neutral", "½×", "¼×" or "no effect". */
export function multiplierWords(multiplier: number) {
  return m.team_matchup_multiplier({ multiplier })
}

/**
 * One plain sentence on `matchup`, `pokemon`'s against `opponent`: how each one's best type does
 * against the other, which is faster, and how much higher one's base stat total is if it's
 * 100 or more. "Golem’s Rock moves are 4× against Charizard, and Charizard’s Fire moves are only
 * ½× against Golem. Charizard is faster."
 */
export function matchupSentence(pokemon: Pokemon, opponent: Pokemon, matchup: Matchup) {
  const name = displayName(pokemon.name)
  const opponentName = displayName(opponent.name)
  const sentences = [
    m.team_matchup_attacks({
      attack: attackClause(name, matchup.attack, opponentName),
      counterattack: attackClause(opponentName, matchup.opponent_attack, name),
    }),
    m.team_matchup_speed({ speed: matchup.speed, pokemon: name, opponent: opponentName }),
  ]
  const gap = matchup.stat_total_difference
  if (Math.abs(gap) >= STAT_GAP_WORTH_SAYING) {
    sentences.push(
      m.team_matchup_stats({ name: gap > 0 ? name : opponentName, difference: Math.abs(gap) }),
    )
  }
  return sentences.join(' ')
}

// "Golem’s Rock moves are 4× against Charizard"
function attackClause(attacker: string, attack: Attack, defender: string) {
  return m.team_matchup_attack({
    multiplier: attack.multiplier,
    attacker,
    type: m.pokemon_type({ type: attack.type }),
    amount: multiplierWords(attack.multiplier),
    defender,
  })
}
