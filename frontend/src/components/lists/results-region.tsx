import type { ReactNode, Ref } from 'react'

import { m } from '@/paraglide/messages.js'

type ResultsRegionProps = {
  ref: Ref<HTMLElement>
  children: ReactNode
}

/** A list's results, as a region that focus can be moved to. */
export function ResultsRegion({ ref, children }: ResultsRegionProps) {
  return (
    <section ref={ref} tabIndex={-1} aria-label={m.common_results()} className="outline-none">
      {children}
    </section>
  )
}
