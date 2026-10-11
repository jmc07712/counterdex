import { describe, expect, it } from 'vitest'

import { m } from '@/paraglide/messages.js'

import { TEAMS_SCOPES, TEAMS_SORTS, TEAMS_VIEWS } from './hooks/use-teams-filters'

// A select message words a value it doesn't know as the value itself.
describe.each(TEAMS_SCOPES)('the Teams page’s %s scope', (scope) => {
  it('has a name, and words for when there are no teams', () => {
    expect(m.teams_scope_option({ scope })).not.toBe(scope)
    expect(m.teams_empty_description({ scope })).not.toBe(scope)
  })
})

describe.each(TEAMS_VIEWS)('the Teams page’s %s view', (view) => {
  it('has a name, and words for when no team matches', () => {
    expect(m.teams_view_option({ view })).not.toBe(view)
    expect(m.teams_nothing_found_title({ view })).not.toBe(view)
    expect(m.teams_nothing_found_description({ view })).not.toBe(view)
  })
})

describe.each(TEAMS_SORTS)('the Teams page’s %s sort', (sort) => {
  it('has a name', () => {
    expect(m.teams_sort_option({ sort })).not.toBe(sort)
  })
})
