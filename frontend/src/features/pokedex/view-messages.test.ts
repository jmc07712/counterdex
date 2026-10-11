import { describe, expect, it } from 'vitest'

import { m } from '@/paraglide/messages.js'

import { POKEDEX_VIEWS } from './hooks/use-pokedex-filters'

// A select message words a view it doesn't know as the view itself.
describe.each(POKEDEX_VIEWS)('the %s view', (view) => {
  it('has a name, and words for when nothing matches', () => {
    expect(m.pokedex_view_option({ view })).not.toBe(view)
    expect(m.pokedex_nothing_found_title({ view })).not.toBe(view)
    expect(m.pokedex_nothing_found_description({ view })).not.toBe(view)
  })
})
