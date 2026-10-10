import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { PokemonType } from '@/api'
import { makePokemon } from '@/test/pokemon'
import { termsAndDefinitions } from '@/test/queries'

import { PokemonCard } from './pokemon-card'
import { TYPE_STYLES } from './pokemon-types'

describe('PokemonCard', () => {
  it('shows the Pokémon’s name, types and Pokédex number', () => {
    render(<PokemonCard pokemon={makePokemon()} />)

    const card = screen.getByRole('article', { name: 'Gyarados' })
    const types = within(card).getByRole('list', { name: 'Types' })
    expect(within(types).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Water',
      'Flying',
    ])
    expect(within(card).getByText('No. 0130')).toBeInTheDocument()
  })

  it('lists every base stat and their total', () => {
    render(<PokemonCard pokemon={makePokemon()} />)

    expect(termsAndDefinitions(screen.getByRole('article'))).toEqual([
      ['HP', '95'],
      ['Attack', '125'],
      ['Defense', '79'],
      ['Sp. Atk', '60'],
      ['Sp. Def', '100'],
      ['Speed', '81'],
      ['Total', '540'],
    ])
  })

  it.each<{ kind: string; types: PokemonType[]; frame: [PokemonType, PokemonType] }>([
    { kind: 'dual-type', types: ['water', 'flying'], frame: ['water', 'flying'] },
    { kind: 'single-type', types: ['electric'], frame: ['electric', 'electric'] },
  ])('frames a $kind Pokémon in its type colors', ({ types, frame: [first, second] }) => {
    render(<PokemonCard pokemon={makePokemon({ types })} />)

    expect(screen.getByRole('article')).toHaveStyle({
      '--type-1': TYPE_STYLES[first].background,
      '--type-2': TYPE_STYLES[second].background,
    })
  })

  it('labels alternate forms', () => {
    render(<PokemonCard pokemon={makePokemon({ is_default: false, form: 'mega' })} />)

    expect(screen.getByText('Mega')).toBeInTheDocument()
  })

  it('shows the sprite as decoration, since the name is already in the heading', () => {
    const pokemon = makePokemon()

    render(<PokemonCard pokemon={pokemon} />)

    // Its empty alt text makes it presentational, so screen readers skip it.
    expect(screen.getByRole('presentation')).toHaveAttribute('src', pokemon.sprite_url)
  })

  it('still renders when PokéAPI has no sprite', () => {
    render(<PokemonCard pokemon={makePokemon({ sprite_url: null })} />)

    expect(screen.getByRole('article', { name: 'Gyarados' })).toBeInTheDocument()
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument()
  })
})
