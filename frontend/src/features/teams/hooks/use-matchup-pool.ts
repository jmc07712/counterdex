import { useSearchParams } from 'react-router'

import type { MatchupPool } from '../types'

/** Neither: what the API picks from unless asked. */
export const DEFAULT_POOL: MatchupPool = { forms: false, legendaries: false }

// The URL's names for the pool's options. Not `forms`, which the Pokédex's filters use.
const FORMS = 'alternate_forms'
const LEGENDARIES = 'legendaries'

/**
 * The pool a team's counter and threats are picked from, kept in the URL
 * (?alternate_forms=true&legendaries=true) so a shared link shows the same picks, and signing in
 * to build the counter comes back to them.
 */
export function useMatchupPool() {
  const [params, setParams] = useSearchParams()

  const pool: MatchupPool = {
    forms: params.get(FORMS) === 'true',
    legendaries: params.get(LEGENDARIES) === 'true',
  }

  function setPool({ forms, legendaries }: MatchupPool) {
    // The URL's other params, such as the open Pokémon, stay.
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete(FORMS)
        next.delete(LEGENDARIES)
        if (forms) next.set(FORMS, 'true')
        if (legendaries) next.set(LEGENDARIES, 'true')
        return next
      },
      { replace: true },
    )
  }

  return [pool, setPool] as const
}
