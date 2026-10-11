import type { Pokemon, Team, TeamMember } from '@/api'

import { makePokemon } from './pokemon'
import { ASH } from './users'

export const TEAM_ID = '00000000-0000-4000-8000-000000000001'

// Charmander's evolution family, and Eevee's.
const CHARMANDER_FAMILY = 2
const EEVEE_FAMILY = 67

/**
 * Pokémon with their species and evolution family, as the API gives them. Each is its own
 * species and family unless noted.
 */
export const catalog = {
  charmander: makePokemon({
    id: 4,
    name: 'charmander',
    types: ['fire'],
    species_id: 4,
    family_id: CHARMANDER_FAMILY,
  }),
  charizard: makePokemon({
    id: 6,
    name: 'charizard',
    types: ['fire', 'flying'],
    species_id: 6,
    family_id: CHARMANDER_FAMILY,
  }),
  // A Charizard.
  charizardMegaX: makePokemon({
    id: 10034,
    name: 'charizard-mega-x',
    types: ['fire', 'dragon'],
    is_default: false,
    form: 'mega',
    species_id: 6,
    family_id: CHARMANDER_FAMILY,
  }),
  pikachu: makePokemon({
    id: 25,
    name: 'pikachu',
    types: ['electric'],
    species_id: 25,
    family_id: 10,
  }),
  gengar: makePokemon({
    id: 94,
    name: 'gengar',
    types: ['ghost', 'poison'],
    species_id: 94,
    family_id: 41,
  }),
  lapras: makePokemon({
    id: 131,
    name: 'lapras',
    types: ['water', 'ice'],
    species_id: 131,
    family_id: 65,
  }),
  eevee: makePokemon({
    id: 133,
    name: 'eevee',
    types: ['normal'],
    species_id: 133,
    family_id: EEVEE_FAMILY,
  }),
  vaporeon: makePokemon({
    id: 134,
    name: 'vaporeon',
    types: ['water'],
    species_id: 134,
    family_id: EEVEE_FAMILY,
  }),
  snorlax: makePokemon({
    id: 143,
    name: 'snorlax',
    types: ['normal'],
    species_id: 143,
    family_id: 72,
  }),
  dragonite: makePokemon({
    id: 149,
    name: 'dragonite',
    types: ['dragon', 'flying'],
    species_id: 149,
    family_id: 74,
  }),
}

export function asMember(pokemon: Pokemon, position: number): TeamMember {
  return { position, pokemon, removed_at: null }
}

export function makeTeam({
  pokemon = [],
  ...overrides
}: Partial<Team> & { pokemon?: Pokemon[] } = {}): Team {
  return {
    id: TEAM_ID,
    name: 'Team 1',
    owner: { username: ASH.username },
    created_at: '2026-10-11T10:00:00Z',
    updated_at: '2026-10-11T10:00:00Z',
    members: pokemon.map(asMember),
    ...overrides,
  }
}
