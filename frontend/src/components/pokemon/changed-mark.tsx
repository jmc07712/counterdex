import { History } from 'lucide-react'

import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

/** The icon for a Pokémon a sync changed in the last week, for decoration beside words. */
export function ChangedIcon({ className }: { className?: string }) {
  return <History aria-hidden="true" className={cn('size-3.5 shrink-0', className)} />
}

/**
 * Marks a Pokémon a sync changed in the last week: a quiet history icon, with words as its
 * tooltip and for screen readers.
 */
export function ChangedMark({ className }: { className?: string }) {
  return (
    <span title={m.pokemon_changed_recently()} className={cn('inline-flex text-muted-foreground', className)}>
      <ChangedIcon />
      <span className="sr-only">{m.pokemon_changed_recently()}</span>
    </span>
  )
}
