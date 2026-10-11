import type { Pokemon, Team, TeamMember } from '@/api'

import { makePokemon } from './pokemon'

export const TEAM_ID = '00000000-0000-4000-8000-000000000001'

/** Pokémon with their species, as the API gives them. Each is its own species unless noted. */
export const catalog = {
  charmander: makePokemon({ id: 4, name: 'charmander', types: ['fire'], species_id: 4 }),
  charizard: makePokemon({ id: 6, name: 'charizard', types: ['fire', 'flying'], species_id: 6 }),
  // A Charizard.
  charizardMegaX: makePokemon({
    id: 10034,
    name: 'charizard-mega-x',
    types: ['fire', 'dragon'],
    is_default: false,
    form: 'mega',
    species_id: 6,
  }),
  pikachu: makePokemon({ id: 25, name: 'pikachu', types: ['electric'], species_id: 25 }),
  gengar: makePokemon({ id: 94, name: 'gengar', types: ['ghost', 'poison'], species_id: 94 }),
  eevee: makePokemon({ id: 133, name: 'eevee', types: ['normal'], species_id: 133 }),
  vaporeon: makePokemon({ id: 134, name: 'vaporeon', types: ['water'], species_id: 134 }),
  snorlax: makePokemon({ id: 143, name: 'snorlax', types: ['normal'], species_id: 143 }),
}

// The catalog's evolution lines, by species, earliest stage first; a branch is a line of its own.
// The stand-in treats two Pokémon in one line as related, as the API does.
export const EVOLUTION_LINES = [
  [4, 5, 6],
  [133, 134],
]

export function asMember(pokemon: Pokemon, position: number): TeamMember {
  return { position, pokemon, removed_at: null, related_pokemon_ids: [] }
}

export function makeTeam({
  pokemon = [],
  ...overrides
}: Partial<Team> & { pokemon?: Pokemon[] } = {}): Team {
  return {
    id: TEAM_ID,
    name: 'Team 1',
    created_at: '2026-10-11T10:00:00Z',
    updated_at: '2026-10-11T10:00:00Z',
    members: pokemon.map(asMember),
    ...overrides,
  }
}
