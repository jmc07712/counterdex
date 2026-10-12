import type { Stats } from '@/api'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { statTotal } from './format'

/** "Total 534": a Pokémon's base stat total, muted but for the number. */
export function StatTotal({ stats, className }: { stats: Stats; className?: string }) {
  return (
    <dl className={cn('flex gap-1 text-muted-foreground', className)}>
      <dt>{m.pokemon_stat_total()}</dt>
      <dd className="font-semibold text-foreground tabular-nums">{statTotal(stats)}</dd>
    </dl>
  )
}
