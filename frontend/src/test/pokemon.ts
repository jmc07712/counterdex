import type { Pokemon, PokemonPage } from '@/api'

// Typed by the generated API types, so these break if the API's Pokémon shape changes.
export function makePokemon(overrides: Partial<Pokemon> = {}): Pokemon {
  return {
    id: 130,
    name: 'gyarados',
    types: ['water', 'flying'],
    stats: { hp: 95, attack: 125, defense: 79, sp_attack: 60, sp_defense: 100, speed: 81 },
    sprite_url: 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/130.png',
    is_default: true,
    form: null,
    ...overrides,
  }
}

/**
 * A page of Pokémon with these names, numbered on from the cursor it was asked `after`. With
 * `more`, its last Pokémon's id is the cursor to the next page, as the API's pages are.
 */
export function makePage(names: string[], { after = 0, more = false } = {}): PokemonPage {
  return {
    items: names.map((name, index) => makePokemon({ id: after + index + 1, name })),
    next_cursor: more ? after + names.length : null,
  }
}
