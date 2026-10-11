import { type ComponentProps, createContext, type ReactNode, type RefObject, use, useState } from 'react'

import { useFirstRender } from '@/hooks/use-first-render'

// How long each item's entrance waits after the one before it.
const STAGGER_MS = 20

// Whether the list is on its first render, when its items are dealt in.
const Dealing = createContext<RefObject<boolean>>({ current: false })

/** A list whose first items are dealt in, one after another. Items it shows later come in at once. */
export function DealtInList(props: ComponentProps<'ul'>) {
  const dealing = useFirstRender()
  return (
    <Dealing value={dealing}>
      <ul {...props} />
    </Dealing>
  )
}

type DealtInItemProps = {
  // Its place in its page of the list.
  index: number
  children: ReactNode
}

/** An item of a DealtInList, which fades and slides in. */
export function DealtInItem({ index, children }: DealtInItemProps) {
  const dealing = use(Dealing)
  // Kept from its first render, as the list's next render would otherwise cut its wait short.
  const [delay] = useState(() => (dealing.current ? index * STAGGER_MS : 0))
  return (
    <li
      style={{ animationDelay: `${delay}ms` }}
      className="animate-in duration-300 fill-mode-both fade-in-0 slide-in-from-bottom-2 motion-reduce:animate-none"
    >
      {children}
    </li>
  )
}
