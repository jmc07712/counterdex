import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { makePokemon } from '@/test/pokemon'

import { PokemonCard } from './pokemon-card'

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

    const card = screen.getByRole('article', { name: 'Gyarados' })
    const names = within(card).getAllByRole('term').map((term) => term.textContent)
    const values = within(card).getAllByRole('definition').map((value) => value.textContent)
    expect(names).toEqual(['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed', 'Total'])
    expect(values).toEqual(['95', '125', '79', '60', '100', '81', '540'])
  })

  it('frames a dual-type Pokémon in both type colors', () => {
    render(<PokemonCard pokemon={makePokemon()} />)

    expect(screen.getByRole('article')).toHaveStyle({
      '--type-1': '#6390f0',
      '--type-2': '#a98ff3',
    })
  })

  it('frames a single-type Pokémon in its one color', () => {
    render(<PokemonCard pokemon={makePokemon({ name: 'pikachu', types: ['electric'] })} />)

    expect(screen.getByRole('article')).toHaveStyle({
      '--type-1': '#f7d02c',
      '--type-2': '#f7d02c',
    })
  })

  it('labels alternate forms', () => {
    render(
      <PokemonCard
        pokemon={makePokemon({
          id: 10034,
          name: 'charizard-mega-x',
          is_default: false,
          form: 'mega',
        })}
      />,
    )

    const card = screen.getByRole('article', { name: 'Charizard Mega X' })
    expect(within(card).getByText('Mega')).toBeInTheDocument()
  })

  it('shows the sprite as decoration, since the name is already in the heading', () => {
    const { container } = render(<PokemonCard pokemon={makePokemon()} />)

    const sprite = container.querySelector('img')
    expect(sprite).toHaveAttribute('src', makePokemon().sprite_url)
    expect(sprite).toHaveAttribute('alt', '')
  })

  it('still renders when PokéAPI has no sprite', () => {
    const { container } = render(<PokemonCard pokemon={makePokemon({ sprite_url: null })} />)

    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByRole('article', { name: 'Gyarados' })).toBeInTheDocument()
  })
})
