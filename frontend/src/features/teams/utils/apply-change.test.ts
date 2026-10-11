import { describe, expect, it } from 'vitest'

import { catalog, makeTeam } from '@/test/teams'

import { applyChange, changedPokemonIds, type TeamChange } from './apply-change'

const { charmander, charizard, pikachu } = catalog

describe('changedPokemonIds', () => {
  it.each<[number[], TeamChange, number[]]>([
    [[4, 25], { kind: 'add', pokemon: charizard }, [4, 25, 6]],
    [[4, 25], { kind: 'remove', pokemonId: 4 }, [25]],
    [[4, 25], { kind: 'replace', pokemonId: 4, pokemon: charizard }, [6, 25]],
    // A Pokémon already on the team moves into the slot.
    [[4, 25, 6], { kind: 'replace', pokemonId: 4, pokemon: charizard }, [6, 25]],
    [[4, 25], { kind: 'reorder', pokemonIds: [25, 4] }, [25, 4]],
    [[4, 25], { kind: 'rename', name: 'Rain' }, [4, 25]],
  ])('%j after %j is %j', (ids, change, expected) => {
    expect(changedPokemonIds(ids, change)).toEqual(expected)
  })
})

describe('applyChange', () => {
  it('renumbers the slots and keeps only relatives still on the team', () => {
    const team = makeTeam({ pokemon: [charmander, pikachu, charizard] })
    team.members[0].related_pokemon_ids = [6]
    team.members[2].related_pokemon_ids = [4]

    const changed = applyChange(team, { kind: 'remove', pokemonId: 4 })

    expect(changed.members.map((member) => [member.position, member.pokemon.id])).toEqual([
      [0, 25],
      [1, 6],
    ])
    expect(changed.members[1].related_pokemon_ids).toEqual([])
  })

  it('renames', () => {
    expect(applyChange(makeTeam(), { kind: 'rename', name: 'Rain' }).name).toBe('Rain')
  })
})
