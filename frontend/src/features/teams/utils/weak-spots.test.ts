import { describe, expect, it } from 'vitest'

import { type Challenger, type Pokemon, PokemonType, Rating } from '@/api'
import { makeMatchup } from '@/test/matchups'
import { catalog } from '@/test/teams'

import { weakSpots } from './weak-spots'

const { charizard, pikachu, gengar, lapras, eevee, vaporeon, snorlax, dragonite } = catalog
const { GRASS, WATER, ICE } = PokemonType

// The team, in battle order.
const TEAM = [charizard, pikachu, gengar, lapras]

// No win against a member.
const _ = null

// `pokemon` as a threat to TEAM, rated good against each member it has an attack type for here,
// with that type, and even against the rest.
function threat(pokemon: Pokemon, attacks: (PokemonType | null)[]): Challenger {
  return {
    pokemon,
    matchups: TEAM.map((member, index) => {
      const type = attacks[index]
      return makeMatchup({
        opponent_id: member.id,
        ...(type && { rating: Rating.GOOD, score: 1, attack: { type, multiplier: 2 } }),
      })
    }),
  }
}

describe('weakSpots', () => {
  it('names the members at least half of the threats beat, the most beaten first', () => {
    const threats = [
      threat(eevee, [WATER, WATER, _, _]),
      threat(vaporeon, [WATER, _, _, _]),
      threat(snorlax, [_, WATER, _, _]),
      threat(dragonite, [_, WATER, WATER, _]),
    ]

    expect(weakSpots(threats, TEAM).exposed).toEqual([pikachu, charizard])
  })

  it('keeps members beaten by as many in battle order', () => {
    const threats = [threat(eevee, [_, WATER, _, WATER]), threat(vaporeon, [_, WATER, _, WATER])]

    expect(weakSpots(threats, TEAM).exposed).toEqual([pikachu, lapras])
  })

  it('names three at most', () => {
    // Charizard is beaten by half of them too, but by fewer than the rest.
    const threats = [
      threat(eevee, [_, WATER, WATER, WATER]),
      threat(vaporeon, [WATER, WATER, WATER, WATER]),
    ]

    expect(weakSpots(threats, TEAM)).toMatchObject({
      exposed: [pikachu, gengar, lapras],
      unnamed: 1,
    })
  })

  it('names none if no member is beaten by half of the threats', () => {
    const threats = [
      threat(eevee, [WATER, _, _, _]),
      threat(vaporeon, [_, WATER, _, _]),
      threat(snorlax, [_, _, _, _]),
    ]

    expect(weakSpots(threats, TEAM).exposed).toEqual([])
  })

  it('finds no weak spots without threats', () => {
    expect(weakSpots([], TEAM)).toEqual({ exposed: [], unnamed: 0, commonType: null })
  })

  it('finds the type more than half of the threats beat members with', () => {
    const threats = [
      threat(eevee, [GRASS, _, _, _]),
      threat(vaporeon, [_, GRASS, _, _]),
      threat(snorlax, [_, _, WATER, _]),
    ]

    expect(weakSpots(threats, TEAM).commonType).toBe(GRASS)
  })

  it('finds no common type if no type is more than half of the threats’', () => {
    const threats = [
      threat(eevee, [GRASS, _, _, _]),
      threat(vaporeon, [GRASS, _, _, _]),
      threat(snorlax, [WATER, _, _, _]),
      threat(dragonite, [_, _, _, _]),
    ]

    expect(weakSpots(threats, TEAM).commonType).toBeNull()
  })

  it('takes the type each threat beats the most members with, the first on a tie', () => {
    const threats = [
      // Ice, beating two to Grass's one.
      threat(eevee, [GRASS, ICE, ICE, _]),
      // Ice, first of the two it beats one with.
      threat(vaporeon, [ICE, _, GRASS, _]),
      threat(snorlax, [GRASS, _, _, _]),
    ]

    expect(weakSpots(threats, TEAM).commonType).toBe(ICE)
  })
})
