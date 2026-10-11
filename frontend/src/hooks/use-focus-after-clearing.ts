import type { RefObject } from 'react'
import { useMediaQuery } from 'usehooks-ts'

// A finger rather than a mouse, as on a phone, where focusing a text box opens the keyboard.
const COARSE_POINTER = '(pointer: coarse)'

/**
 * Moves focus after a list's filters are cleared: to the search box, or with a coarse pointer to
 * the results, as focusing the search box would open the on-screen keyboard over them.
 */
export function useFocusAfterClearing(
  search: RefObject<HTMLInputElement | null>,
  results: RefObject<HTMLElement | null>,
) {
  const coarsePointer = useMediaQuery(COARSE_POINTER)
  return () => {
    if (coarsePointer) results.current?.focus()
    else search.current?.focus()
  }
}
