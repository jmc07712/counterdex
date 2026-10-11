import type { ReactNode } from 'react'

import { m } from '@/paraglide/messages.js'

type FilterBarProps = {
  search: ReactNode
  // Beside the search on wider screens, under it on phones.
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex-1">{search}</div>
        <div className="flex flex-wrap gap-x-4 gap-y-3">{choices}</div>
      </div>
      {children}
    </section>
  )
}
