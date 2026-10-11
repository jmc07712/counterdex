import type { ReactNode } from 'react'

// How long each item's entrance waits after the one before it.
const STAGGER_MS = 20

type DealtInItemProps = {
  // Its place in its page, so each new page is dealt in from its first item.
  index: number
  children: ReactNode
}

/** A list item that fades and slides in a moment after the one before it. */
export function DealtInItem({ index, children }: DealtInItemProps) {
  return (
    <li
      style={{ animationDelay: `${index * STAGGER_MS}ms` }}
      className="animate-in duration-300 fill-mode-both fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
    >
      {children}
    </li>
  )
}
