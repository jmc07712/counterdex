import { useSearchParams } from 'react-router'

// The highest page the API takes.
const MAX_PAGE = 2 ** 31 - 1

/**
 * The page of sync runs to show, kept in the URL (?page=2) so it can be shared or reloaded. A
 * value that isn't a page the API takes, as a hand-edited URL can have, is page 1.
 */
export function useRunsPage() {
  const [params] = useSearchParams()
  const page = Number(params.get('page'))
  return Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1
}
