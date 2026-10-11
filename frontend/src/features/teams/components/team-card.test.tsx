import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

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

  it('shows no types for a team with no Pokémon', () => {
    renderWithProviders(<TeamCard to="/teams/1" name="Empty" members={[]} />)

    expect(screen.queryByRole('list', { name: 'Types' })).not.toBeInTheDocument()
  })
})
