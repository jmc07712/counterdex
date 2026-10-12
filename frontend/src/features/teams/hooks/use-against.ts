import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

const PARAM = 'against'

/**
 * The id of the team being matched up against, kept in the URL (?against=<id>), as building a
 * counter sets it; `stop` takes it out.
 */
export function useAgainst() {
  const [params, setParams] = useSearchParams()
  const teamId = params.get(PARAM)

  const stop = useCallback(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete(PARAM)
        return next
      },
      { replace: true },
    )
  }, [setParams])

  return { teamId, stop }
}
