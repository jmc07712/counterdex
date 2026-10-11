import { describe, expect, it } from 'vitest'

import { asMember, catalog } from '@/test/teams'

import { cantAdd } from './can-add'

const { charizard, charizardMegaX, pikachu, snorlax, gengar, eevee, charmander } = catalog

describe('cantAdd', () => {
  it('allows a species not on the team', () => {
    expect(cantAdd([asMember(pikachu, 0)], charizard)).toBeNull()
  })

  it('refuses a second of one species, in any form', () => {
    expect(cantAdd([asMember(charizard, 0)], charizardMegaX)).toBe('species_on_team')
  })

  it('refuses a seventh member', () => {
    const six = [pikachu, snorlax, gengar, eevee, charmander, charizardMegaX].map(asMember)
    expect(cantAdd(six, catalog.vaporeon)).toBe('team_full')
  })
})
