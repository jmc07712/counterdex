import { describe, expect, it } from 'vitest'

import { TeamConflictReason } from '@/api'
import { asMember, catalog } from '@/test/teams'

import { cantAdd, familyMember } from './can-add'

const { charmander, charizard, charizardMegaX, pikachu, snorlax, gengar, lapras, eevee } = catalog

describe('cantAdd', () => {
  it('allows a Pokémon whose evolution family isn’t on the team', () => {
    expect(cantAdd([asMember(pikachu, 0)], charizard)).toBeNull()
  })

  it.each([
    ['the same Pokémon', charmander, charmander],
    ['a later stage', charmander, charizard],
    ['an earlier stage', catalog.vaporeon, eevee],
    ['another form of its species', charizard, charizardMegaX],
  ])('refuses a second from one evolution family: %s', (_, member, pokemon) => {
    expect(cantAdd([asMember(member, 0)], pokemon)).toBe(TeamConflictReason.FAMILY_ON_TEAM)
  })

  it('refuses a seventh member', () => {
    const six = [pikachu, snorlax, gengar, lapras, eevee, charmander].map(asMember)
    expect(cantAdd(six, catalog.dragonite)).toBe(TeamConflictReason.TEAM_FULL)
  })
})

describe('familyMember', () => {
  it('finds the member from the Pokémon’s evolution family, or the Pokémon itself', () => {
    const members = [asMember(pikachu, 0), asMember(charmander, 1)]

    expect(familyMember(members, charizardMegaX)).toBe(members[1])
    expect(familyMember(members, pikachu)).toBe(members[0])
    expect(familyMember(members, snorlax)).toBeUndefined()
  })
})
