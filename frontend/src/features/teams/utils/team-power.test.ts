import { describe, expect, it } from 'vitest'

import { makePokemon } from '@/test/pokemon'
import { asMember } from '@/test/teams'

import { teamPower } from './team-power'

const STATS = { hp: 0, attack: 0, defense: 0, sp_attack: 0, sp_defense: 0, speed: 0 }

describe('teamPower', () => {
  it('adds up its members’ base stat totals', () => {
    const members = [
      makePokemon({ stats: { ...STATS, hp: 100, speed: 50 } }),
      makePokemon({ stats: { ...STATS, attack: 200, defense: 25 } }),
    ].map(asMember)

    expect(teamPower(members)).toBe(375)
  })

  it('is nothing for a team with no members', () => {
    expect(teamPower([])).toBe(0)
  })
})
