import { useSearchParams } from 'react-router'

import type { MatchupPool } from '../types'

/** Neither: what the API picks from unless asked. */
export const DEFAULT_POOL: MatchupPool = { forms: false, legendaries: false }

/**
 * The pool a team's counter and threats are picked from, kept in the URL
 * (?forms=true&legendaries=true) so a shared link shows the same picks, and signing in to build
 * the counter comes back to them.
 */
export function useMatchupPool() {
  const [params, setParams] = useSearchParams()

  const pool: MatchupPool = {
    forms: params.get('forms') === 'true',
    legendaries: params.get('legendaries') === 'true',
  }

  function setPool({ forms, legendaries }: MatchupPool) {
    // The URL's other params, such as the open Pokémon, stay.
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete('forms')
        next.delete('legendaries')
        if (forms) next.set('forms', 'true')
        if (legendaries) next.set('legendaries', 'true')
        return next
      },
      { replace: true },
    )
  }

  return [pool, setPool] as const
}
