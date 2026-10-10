import { History } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Marks a Pokémon a sync changed in the last week: a quiet history icon, with words as its
 * tooltip and for screen readers.
 */
export function ChangedMark({ className }: { className?: string }) {
  return (
    <span title="Changed recently" className={cn('inline-flex text-muted-foreground', className)}>
      <History aria-hidden="true" className="size-3.5" />
      <span className="sr-only">Changed recently</span>
    </span>
  )
}
