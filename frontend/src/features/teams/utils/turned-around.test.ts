import { describe, expect, it } from 'vitest'

import { PokemonType, Rating, RelativeSpeed } from '@/api'
import { makeMatchup } from '@/test/matchups'
import { catalog } from '@/test/teams'

import { turnedAround } from './turned-around'

const { charizard, lapras } = catalog
const { GOOD, EVEN, BAD } = Rating
const { FASTER, TIED, SLOWER } = RelativeSpeed

// Lapras's matchup against Charizard: Water moves 2× against it, its Fire moves ½× back.
const LAPRAS_ON_CHARIZARD = makeMatchup({
  opponent_id: charizard.id,
  attack: { type: PokemonType.WATER, multiplier: 2 },
  opponent_attack: { type: PokemonType.FIRE, multiplier: 0.5 },
  speed: SLOWER,
  stat_total_difference: 1,
  score: 1.7525,
  rating: GOOD,
})

describe('turnedAround', () => {
  it('gives the opponent’s matchup against the Pokémon', () => {
    expect(turnedAround(LAPRAS_ON_CHARIZARD, lapras.id)).toEqual({
      opponent_id: lapras.id,
      attack: { type: PokemonType.FIRE, multiplier: 0.5 },
      opponent_attack: { type: PokemonType.WATER, multiplier: 2 },
      speed: FASTER,
      stat_total_difference: -1,
      score: -1.7525,
      rating: BAD,
    })
  })

  it.each([
    [GOOD, BAD],
    [EVEN, EVEN],
    [BAD, GOOD],
  ])('turns a %s rating into %s', (rating, turned) => {
    const matchup = makeMatchup({ opponent_id: charizard.id, rating })

    expect(turnedAround(matchup, lapras.id).rating).toBe(turned)
  })

  it.each([
    [FASTER, SLOWER],
    [TIED, TIED],
    [SLOWER, FASTER],
  ])('turns %s into %s', (speed, turned) => {
    const matchup = makeMatchup({ opponent_id: charizard.id, speed })

    expect(turnedAround(matchup, lapras.id).speed).toBe(turned)
  })

  it('gives back the matchup it started from when turned around twice', () => {
    const turned = turnedAround(LAPRAS_ON_CHARIZARD, lapras.id)

    expect(turnedAround(turned, charizard.id)).toEqual(LAPRAS_ON_CHARIZARD)
  })
})
