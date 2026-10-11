import { describe, expect, it } from 'vitest'

import { m } from '@/paraglide/messages.js'

import { EXPLORE_VIEWS } from './hooks/use-explore-filters'

// A select message words a view it doesn't know as the view itself.
describe.each(EXPLORE_VIEWS)('the %s view of Explore', (view) => {
  it('has a name, and words for when no team matches', () => {
    expect(m.explore_view_option({ view })).not.toBe(view)
    expect(m.explore_nothing_found_title({ view })).not.toBe(view)
    expect(m.explore_nothing_found_description({ view })).not.toBe(view)
  })
})
