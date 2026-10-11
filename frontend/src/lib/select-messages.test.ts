import { describe, expect, it } from 'vitest'

import {
  ChangeKind,
  EvolutionTrigger,
  FormFilter,
  Gender,
  PokemonForm,
  PokemonType,
  RelativePhysicalStats,
  TimeOfDay,
} from '@/api'
import { STATS } from '@/components/pokemon/format'
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
])('%s', (_, values, word) => {
  it.each(values)('words %s', (value) => {
    expect(word(value)).not.toBe(value)
  })
})
