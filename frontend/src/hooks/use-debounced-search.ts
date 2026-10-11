import { useEffect } from 'react'
import { useDebounceValue } from 'usehooks-ts'

// Wait for a pause in typing before searching, so each keystroke isn't a request.
const SEARCH_DELAY_MS = 250

/**
 * The search once typing pauses, without spaces around it. A cleared search is given at once, so
 * clearing the filters doesn't first ask for the old search on its own.
 */
export function useDebouncedSearch(search: string) {
  const trimmed = search.trim()
  const cleared = trimmed === ''
  const [debounced, setDebounced] = useDebounceValue(trimmed, SEARCH_DELAY_MS)

  useEffect(() => {
    // Settle on the cleared search now, so the next search waits from it, not the one before.
    if (cleared) setDebounced.flush()
  }, [cleared, setDebounced])

  return cleared ? '' : debounced
}
