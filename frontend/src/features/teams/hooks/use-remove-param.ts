import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

/**
 * A function that takes the search param `name` out of the URL, keeping the rest, in place of the
 * current history entry.
 */
export function useRemoveParam(name: string) {
  const [, setParams] = useSearchParams()
  return useCallback(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete(name)
        return next
      },
      { replace: true },
    )
  }, [setParams, name])
}
