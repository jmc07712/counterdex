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

export function makePage(names: string[], nextCursor: number | null = null): PokemonPage {
  return {
    items: names.map((name, index) => makePokemon({ id: index + 1, name })),
    next_cursor: nextCursor,
  }
}
