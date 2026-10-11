import type { ReactNode } from 'react'

import { m } from '@/paraglide/messages.js'

type FilterBarProps = {
  search: ReactNode
  // Beside the search where there's room for both, otherwise under it.
  choices: ReactNode
  // Rows across the bar, under the search.
  children: ReactNode
}

/** A page's filters, above what they filter. */
export function FilterBar({ search, choices, children }: FilterBarProps) {
  return (
    <section
      aria-label={m.filters_label()}
      // Pinned below the header on wider screens; on phones it would take a fifth of the screen.
      className="-mx-4 mb-6 flex flex-col gap-3 border-b bg-background px-4 py-3 sm:sticky sm:top-14 sm:z-30 sm:-mx-6 sm:px-6"
    >
      {/* The choices go under the search, rather than squeezing it, unless the search has
          18rem beside them. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="grow basis-72">{search}</div>
        <div className="flex flex-wrap gap-x-4 gap-y-3">{choices}</div>
      </div>
      {children}
    </section>
  )
}
