import { History } from 'lucide-react'

import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

/**
 * Marks a Pokémon a sync changed in the last week: a quiet history icon, with words as its
 * tooltip and for screen readers.
 */
export function ChangedMark({ className }: { className?: string }) {
  return (
    <span title={m.pokemon_changed_recently()} className={cn('inline-flex text-muted-foreground', className)}>
      <History aria-hidden="true" className="size-3.5" />
      <span className="sr-only">{m.pokemon_changed_recently()}</span>
    </span>
  )
}
