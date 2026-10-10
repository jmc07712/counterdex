import type { Pokemon, PokemonDetails, PokemonPage } from '@/api'

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
    changed_recently: false,
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

const CHARMANDER = makePokemon({ id: 4, name: 'charmander', types: ['fire'] })
const CHARMELEON = makePokemon({ id: 5, name: 'charmeleon', types: ['fire'] })
export const CHARIZARD = makePokemon({ id: 6, name: 'charizard', types: ['fire', 'flying'] })
export const CHARIZARD_MEGA_X = makePokemon({
  id: 10034,
  name: 'charizard-mega-x',
  types: ['fire', 'dragon'],
  is_default: false,
  form: 'mega',
})

/** Charizard's details: its forms, and Charmander's family with the level each stage evolves at. */
export function makeDetails(overrides: Partial<PokemonDetails> = {}): PokemonDetails {
  const charizard = { id: 6, name: 'charizard', genus: 'Flame Pokémon' }
  return {
    pokemon: CHARIZARD,
    removed_at: null,
    species: charizard,
    forms: [CHARIZARD, CHARIZARD_MEGA_X],
    evolution: {
      species: { id: 4, name: 'charmander', genus: 'Lizard Pokémon' },
      pokemon: CHARMANDER,
      methods: [],
      evolves_to: [
        {
          species: { id: 5, name: 'charmeleon', genus: 'Flame Pokémon' },
          pokemon: CHARMELEON,
          methods: [{ trigger: 'level-up', min_level: 16 }],
          evolves_to: [
            {
              species: charizard,
              pokemon: CHARIZARD,
              methods: [{ trigger: 'level-up', min_level: 36 }],
              evolves_to: [],
            },
          ],
        },
      ],
    },
    ...overrides,
  }
}
