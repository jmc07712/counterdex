import { describe, expect, it } from 'vitest'

import { PokemonType, RelativeSpeed } from '@/api'
import { makeMatchup } from '@/test/matchups'
import { makePokemon } from '@/test/pokemon'

import { matchupSentence, multiplierWords } from './matchup-sentence'

const GOLEM = makePokemon({ id: 76, name: 'golem', types: ['rock', 'ground'] })
const CHARIZARD = makePokemon({ id: 6, name: 'charizard', types: ['fire', 'flying'] })

// Golem's matchup against Charizard: Rock moves 4× against it, its Fire moves ½× back.
const ROCK_BEATS_FIRE = makeMatchup({
  opponent_id: CHARIZARD.id,
  attack: { type: PokemonType.ROCK, multiplier: 4 },
  opponent_attack: { type: PokemonType.FIRE, multiplier: 0.5 },
  speed: RelativeSpeed.SLOWER,
})

describe('multiplierWords', () => {
  it.each([
    [4, '4×'],
    [2, '2×'],
    [1, 'neutral'],
    [0.5, '½×'],
    [0.25, '¼×'],
    [0, 'no effect'],
  ])('words %s× as “%s”', (multiplier, words) => {
    expect(multiplierWords(multiplier)).toBe(words)
  })
})

describe('matchupSentence', () => {
  it('says how each one’s best type does against the other, and which is faster', () => {
    expect(matchupSentence(GOLEM, CHARIZARD, ROCK_BEATS_FIRE)).toBe(
      'Golem’s Rock moves are 4× against Charizard, and Charizard’s Fire moves are only ½× ' +
        'against Golem. Charizard is faster.',
    )
  })

  it.each([
    [RelativeSpeed.FASTER, 'Golem is faster.'],
    [RelativeSpeed.SLOWER, 'Charizard is faster.'],
    [RelativeSpeed.TIED, 'They’re equally fast.'],
  ])('when it’s %s, ends “%s”', (speed, ending) => {
    const sentence = matchupSentence(GOLEM, CHARIZARD, { ...ROCK_BEATS_FIRE, speed })

    expect(sentence.endsWith(` ${ending}`)).toBe(true)
  })

  it.each([
    [2, 'Golem’s Rock moves are 2× against Charizard'],
    [1, 'Golem’s Rock moves are neutral against Charizard'],
    [0.5, 'Golem’s Rock moves are only ½× against Charizard'],
    [0.25, 'Golem’s Rock moves are only ¼× against Charizard'],
    [0, 'Golem’s Rock moves have no effect on Charizard'],
  ])('words its own attack at %s× as “%s”', (multiplier, attack) => {
    const matchup = { ...ROCK_BEATS_FIRE, attack: { type: PokemonType.ROCK, multiplier } }

    expect(matchupSentence(GOLEM, CHARIZARD, matchup)).toMatch(new RegExp(`^${attack}, and `))
  })

  it.each([
    [4, 'Charizard’s Water moves are 4× against Golem.'],
    [1, 'Charizard’s Water moves are neutral against Golem.'],
    [0.25, 'Charizard’s Water moves are only ¼× against Golem.'],
    [0, 'Charizard’s Water moves have no effect on Golem.'],
  ])('words the opponent’s attack at %s× as “%s”', (multiplier, counterattack) => {
    const matchup = {
      ...ROCK_BEATS_FIRE,
      opponent_attack: { type: PokemonType.WATER, multiplier },
    }

    expect(matchupSentence(GOLEM, CHARIZARD, matchup)).toContain(`, and ${counterattack} `)
  })

  it.each([
    [120, 'Golem’s base stats total 120 more.'],
    [-150, 'Charizard’s base stats total 150 more.'],
  ])('adds a gap in base stat totals of %s', (difference, stats) => {
    const matchup = { ...ROCK_BEATS_FIRE, stat_total_difference: difference }

    expect(matchupSentence(GOLEM, CHARIZARD, matchup)).toBe(
      'Golem’s Rock moves are 4× against Charizard, and Charizard’s Fire moves are only ½× ' +
        `against Golem. Charizard is faster. ${stats}`,
    )
  })

  it.each([99, -99, 0])('leaves out a gap in base stat totals of %s', (difference) => {
    const matchup = { ...ROCK_BEATS_FIRE, stat_total_difference: difference }

    expect(matchupSentence(GOLEM, CHARIZARD, matchup)).toMatch(/Charizard is faster\.$/)
  })
})
