import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { makePokemon } from '@/test/pokemon'
import { renderWithProviders } from '@/test/render'
import { asMember, catalog } from '@/test/teams'

import { TeamCard } from './team-card'

describe('TeamCard', () => {
  it('shows each of the team’s types once, in battle order', () => {
    const members = [catalog.charizard, catalog.vaporeon, catalog.dragonite].map(asMember)

    renderWithProviders(<TeamCard to="/teams/1" name="Sky" members={members} />)

    const types = screen.getByRole('list', { name: 'Types' })
    expect(within(types).getAllByRole('listitem').map((type) => type.textContent)).toEqual([
      'Fire',
      'Flying',
      'Water',
      'Dragon',
    ])
  })

  it('fills its power’s bar for a team past the most it measures against', () => {
    // 780 each, as Mega Mewtwo X's.
    const stats = { hp: 106, attack: 190, defense: 100, sp_attack: 154, sp_defense: 100, speed: 130 }
    const members = [1, 2, 3, 4, 5, 6].map((id, position) =>
      asMember(makePokemon({ id, stats }), position),
    )

    renderWithProviders(<TeamCard to="/teams/1" name="Megas" members={members} />)

    const power = screen.getByRole('meter', { name: 'Team power' })
    expect(power).toHaveAttribute('aria-valuenow', '4680')
    expect(power).toHaveAttribute('aria-valuemax', '4680')
  })

  it('shows no types for a team with no Pokémon', () => {
    renderWithProviders(<TeamCard to="/teams/1" name="Empty" members={[]} />)

    expect(screen.queryByRole('list', { name: 'Types' })).not.toBeInTheDocument()
  })
})
