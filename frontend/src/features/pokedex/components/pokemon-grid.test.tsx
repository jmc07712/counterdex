import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ListingStatus, type Pokemon } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { servePokemon } from '@/test/handlers/pokemon'
import { makePage } from '@/test/pokemon'
import { renderWithProviders } from '@/test/render'

import { NO_FILTERS } from '../hooks/use-pokedex-filters'
import { PokemonGrid } from './pokemon-grid'

function pickButton(pokemon: Pokemon) {
  return <button>Pick {displayName(pokemon.name)}</button>
}

describe('PokemonGrid', () => {
  it('shows the action for each card’s Pokémon', async () => {
    servePokemon(makePage(['bulbasaur', 'ivysaur']))

    renderWithProviders(
      <PokemonGrid
        filters={NO_FILTERS}
        onClearFilters={vi.fn()}
        onOpen={vi.fn()}
        cardAction={pickButton}
      />,
    )

    const bulbasaur = await screen.findByRole('article', { name: 'Bulbasaur' })
    expect(within(bulbasaur).getByRole('button', { name: 'Pick Bulbasaur' })).toBeInTheDocument()
    const ivysaur = screen.getByRole('article', { name: 'Ivysaur' })
    expect(within(ivysaur).getByRole('button', { name: 'Pick Ivysaur' })).toBeInTheDocument()
  })

  it('shows no action on the Pokémon PokéAPI no longer lists', async () => {
    servePokemon(makePage(['bulbasaur']))

    renderWithProviders(
      <PokemonGrid
        filters={{ ...NO_FILTERS, view: ListingStatus.REMOVED }}
        onClearFilters={vi.fn()}
        onOpen={vi.fn()}
        cardAction={pickButton}
      />,
    )

    await screen.findByRole('article', { name: 'Bulbasaur' })
    expect(screen.queryByRole('button', { name: /Pick/ })).not.toBeInTheDocument()
  })
})
