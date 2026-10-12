import { describe, expect, it } from 'vitest'

import {
  ChangeKind,
  EvolutionTrigger,
  FormFilter,
  Gender,
  PokemonForm,
  PokemonType,
  Rating,
  RelativePhysicalStats,
  RelativeSpeed,
  SyncStatus,
  TeamConflictReason,
  TimeOfDay,
} from '@/api'
import { STATS } from '@/components/pokemon/format'
import { POKEDEX_VIEWS } from '@/features/pokedex/hooks/use-pokedex-filters'
import { TEAMS_SCOPES, TEAMS_SORTS, TEAMS_VIEWS } from '@/features/teams/hooks/use-teams-filters'
import { m } from '@/paraglide/messages.js'

// A select message words a value it doesn't know as the value itself, so a value worded as
// itself has no wording of its own in messages/en.json.
describe.each<[string, string[], (value: string) => string]>([
  ['pokemon_type', Object.values(PokemonType), (type) => m.pokemon_type({ type })],
  ['pokemon_form', Object.values(PokemonForm), (form) => m.pokemon_form({ form })],
  ['pokemon_stat', [...STATS], (stat) => m.pokemon_stat({ stat })],
  ['changes_kind', Object.values(ChangeKind), (kind) => m.changes_kind({ kind })],
  [
    'pokedex_forms_option',
    Object.values(FormFilter),
    (forms) => m.pokedex_forms_option({ forms }),
  ],
  [
    'evolution_trigger',
    Object.values(EvolutionTrigger),
    (trigger) => m.evolution_trigger({ trigger }),
  ],
  ['evolution_time_of_day', Object.values(TimeOfDay), (time) => m.evolution_time_of_day({ time })],
  ['evolution_gender', Object.values(Gender), (gender) => m.evolution_gender({ gender })],
  [
    'evolution_physical_stats',
    Object.values(RelativePhysicalStats),
    (stats) => m.evolution_physical_stats({ stats }),
  ],
  [
    'team_problem',
    [...Object.values(TeamConflictReason), 'signed_out', 'not_owner', 'not_found', 'failed'],
    (problem) => m.team_problem({ problem }),
  ],
  ['admin_run_status', Object.values(SyncStatus), (status) => m.admin_run_status({ status })],
  ['team_matchup_rating', Object.values(Rating), (rating) => m.team_matchup_rating({ rating })],
  [
    'team_matchup_reason',
    Object.values(Rating),
    (rating) => m.team_matchup_reason({ rating, names: 'Charizard' }),
  ],
  [
    'team_threat_reason',
    Object.values(Rating),
    (rating) => m.team_threat_reason({ rating, names: 'Charizard' }),
  ],
  [
    'team_matchup_speed',
    Object.values(RelativeSpeed),
    (speed) => m.team_matchup_speed({ speed, pokemon: 'Golem', opponent: 'Charizard' }),
  ],
  ['pokedex_view_option', [...POKEDEX_VIEWS], (view) => m.pokedex_view_option({ view })],
  [
    'pokedex_nothing_found_title',
    [...POKEDEX_VIEWS],
    (view) => m.pokedex_nothing_found_title({ view }),
  ],
  [
    'pokedex_nothing_found_description',
    [...POKEDEX_VIEWS],
    (view) => m.pokedex_nothing_found_description({ view }),
  ],
  ['teams_scope_option', [...TEAMS_SCOPES], (scope) => m.teams_scope_option({ scope })],
  ['teams_empty_description', [...TEAMS_SCOPES], (scope) => m.teams_empty_description({ scope })],
  ['teams_view_option', [...TEAMS_VIEWS], (view) => m.teams_view_option({ view })],
  ['teams_nothing_found_title', [...TEAMS_VIEWS], (view) => m.teams_nothing_found_title({ view })],
  [
    'teams_nothing_found_description',
    [...TEAMS_VIEWS],
    (view) => m.teams_nothing_found_description({ view }),
  ],
  ['teams_sort_option', [...TEAMS_SORTS], (sort) => m.teams_sort_option({ sort })],
])('%s', (_, values, word) => {
  it.each(values)('words %s', (value) => {
    expect(word(value)).not.toBe(value)
  })
})
