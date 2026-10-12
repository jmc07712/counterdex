import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

type DisclosureProps = {
  summary: string
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * `children` folded away under a quiet line of text, with a chevron that turns over when it opens.
 * A native `<details>`, so it opens from the keyboard and says whether it's open without any ARIA.
 */
export function Disclosure({ summary, defaultOpen, children }: DisclosureProps) {
  return (
    <details open={defaultOpen} className="group/disclosure">
      <summary className="-mx-1 flex w-fit cursor-pointer list-none items-center gap-1 rounded-md px-1 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        {summary}
        <ChevronDown
          aria-hidden="true"
          className="size-4 transition-transform group-open/disclosure:rotate-180"
        />
      </summary>
      {children}
    </details>
  )
}
