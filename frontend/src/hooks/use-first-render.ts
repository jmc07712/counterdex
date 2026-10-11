import { type RefObject, useEffect, useRef } from 'react'

/**
 * A ref that's true until the component has mounted, then false. Setting it doesn't render
 * anything again, so it's for reading as something is first made, such as a state's first value.
 */
export function useFirstRender(): RefObject<boolean> {
  const first = useRef(true)
  useEffect(() => {
    first.current = false
  }, [])
  return first
}
