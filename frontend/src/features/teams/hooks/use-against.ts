import { useSearchParams } from 'react-router'

import { useRemoveParam } from './use-remove-param'

const PARAM = 'against'

/**
 * The id of the team being matched up against, kept in the URL (?against=<id>), as building a
 * counter sets it; `stop` takes it out.
 */
export function useAgainst() {
  const [params] = useSearchParams()
  const stop = useRemoveParam(PARAM)
  return { teamId: params.get(PARAM), stop }
}
