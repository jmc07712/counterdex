import { useDebounceValue } from 'usehooks-ts'

// Wait for a pause in typing before searching, so each keystroke isn't a request.
const SEARCH_DELAY_MS = 250

/** The search once typing pauses, without spaces around it. */
export function useDebouncedSearch(search: string) {
  const [debounced] = useDebounceValue(search, SEARCH_DELAY_MS)
  return debounced.trim()
}
