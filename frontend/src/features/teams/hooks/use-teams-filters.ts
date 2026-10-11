import { useSearchParams } from 'react-router'

import type { PokemonType } from '@/api'
import { toPokemonTypes } from '@/components/pokemon/pokemon-types'
import { parseOption } from '@/lib/search-params'

/** Whose teams the Teams page shows: your own, or everyone's. */
export type TeamsScope = 'mine' | 'everyone'
export const TEAMS_SCOPES: TeamsScope[] = ['mine', 'everyone']

/** Which of those teams it shows: all of them, or those with a Pokémon a sync changed lately. */
export type TeamsView = 'all' | 'changed'
export const TEAMS_VIEWS: TeamsView[] = ['all', 'changed']

export type TeamsFilters = {
  scope: TeamsScope
  search: string
  types: PokemonType[]
  view: TeamsView
}

/** What Clear filters goes back to. Whose teams are shown stays as it is. */
export const NO_FILTERS: Omit<TeamsFilters, 'scope'> = { search: '', types: [], view: 'all' }

/**
 * The Teams page's filters, kept in the URL (?scope=everyone&q=rain&type=water&view=changed) so a
 * filtered view can be shared, bookmarked, or reloaded. Someone signed in sees their own teams
 * unless the URL asks for everyone's; someone signed out sees everyone's.
 */
export function useTeamsFilters({ signedIn }: { signedIn: boolean }) {
  const [params, setParams] = useSearchParams()

  const filters: TeamsFilters = {
    scope: signedIn ? (parseOption(TEAMS_SCOPES, params.get('scope')) ?? 'mine') : 'everyone',
    search: params.get('q') ?? '',
    // Each type once, as a hand-edited URL can repeat one.
    types: [...new Set(toPokemonTypes(params.getAll('type')))],
    view: parseOption(TEAMS_VIEWS, params.get('view')) ?? 'all',
  }

  function setFilters({ scope, search, types, view }: TeamsFilters) {
    const next = new URLSearchParams()
    if (signedIn && scope === 'everyone') next.set('scope', scope)
    if (search) next.set('q', search)
    for (const type of types) next.append('type', type)
    if (view !== 'all') next.set('view', view)
    // Replace rather than push, so typing a search doesn't add a history entry per keystroke.
    setParams(next, { replace: true })
  }

  return [filters, setFilters] as const
}
