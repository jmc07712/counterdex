import { describe, expect, it } from 'vitest'

import type { Team } from '@/api'
import { catalog, makeTeam } from '@/test/teams'

import { withAdded, withName, withOrder, withRemoved, withReplaced } from './changed-team'

const { charmander, charizard, pikachu, snorlax } = catalog

// Each member as [slot, Pokémon id].
function slots(team: Team) {
  return team.members.map((member) => [member.position, member.pokemon.id])
}

describe('withAdded', () => {
  it('puts the Pokémon in the next free slot', () => {
    const team = makeTeam({ pokemon: [charmander, pikachu] })

    const changed = withAdded(team, snorlax)

    expect(slots(changed)).toEqual([
      [0, 4],
      [1, 25],
      [2, 143],
    ])
    expect(changed.members[2]).toEqual({
      position: 2,
      pokemon: snorlax,
      removed_at: null,
      related_pokemon_ids: [],
    })
  })
})

describe('withRemoved', () => {
  it('moves the members after it up a slot, keeping only relatives still on the team', () => {
    const team = makeTeam({ pokemon: [charmander, pikachu, charizard] })
    team.members[0].related_pokemon_ids = [6]
    team.members[2].related_pokemon_ids = [4]

    const changed = withRemoved(team, 4)

    expect(slots(changed)).toEqual([
      [0, 25],
      [1, 6],
    ])
    expect(changed.members[1].related_pokemon_ids).toEqual([])
  })
})

describe('withReplaced', () => {
  it('puts the Pokémon in the member’s slot', () => {
    const team = makeTeam({ pokemon: [charmander, pikachu] })

    expect(slots(withReplaced(team, 4, charizard))).toEqual([
      [0, 6],
      [1, 25],
    ])
  })

  it.each([
    // Moving down the team, and moving up it.
    [[4, 25, 6], [6, 25]],
    [[6, 25, 4], [25, 6]],
  ])('moves a Pokémon already on the team into the slot: %j to %j', (before, after) => {
    const pokemon = [charmander, pikachu, charizard]
    const team = makeTeam({
      pokemon: before.flatMap((id) => pokemon.filter((each) => each.id === id)),
    })

    const changed = withReplaced(team, 4, charizard)

    expect(changed.members.map((member) => member.pokemon.id)).toEqual(after)
    expect(changed.members.map((member) => member.position)).toEqual([0, 1])
  })
})

describe('withOrder', () => {
  it('puts the members in the order given', () => {
    const team = makeTeam({ pokemon: [charmander, pikachu, snorlax] })

    expect(slots(withOrder(team, [143, 4, 25]))).toEqual([
      [0, 143],
      [1, 4],
      [2, 25],
    ])
  })
})

describe('withName', () => {
  it('renames the team, leaving its members', () => {
    const team = makeTeam({ pokemon: [pikachu] })

    const changed = withName(team, 'Rain')

    expect(changed.name).toBe('Rain')
    expect(changed.members).toEqual(team.members)
  })
})
