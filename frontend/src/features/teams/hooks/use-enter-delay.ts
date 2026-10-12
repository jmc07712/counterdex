import { createContext, type RefObject, use, useState } from 'react'

// Slots enter one after another, in battle order, this far apart.
const ENTER_STAGGER_MS = 70

/** A slot's entrance, after its useEnterDelay. */
export const ENTER =
  'animate-in fade-in-0 slide-in-from-bottom-3 duration-300 fill-mode-both motion-reduce:animate-none'

/** Whether the slots are on their first render, when they enter one after another. */
export const Entering = createContext<RefObject<boolean>>({ current: false })

/**
 * How long a slot waits to enter: its place in battle order when the slots first show, and not at
 * all when it shows later. Kept from its first render, as the slots' next render would otherwise
 * cut its wait short.
 */
export function useEnterDelay(slot: number) {
  const entering = use(Entering)
  const [delay] = useState(() => (entering.current ? slot * ENTER_STAGGER_MS : 0))
  return delay
}
