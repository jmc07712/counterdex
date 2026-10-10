import type { Stats } from '@/api'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

import { STAT_LABELS, STATS } from './format'

// Bars measure against the highest base stat the API allows, so they compare across Pokémon.
const MAX_BASE_STAT = 255

/** A Pokémon's base stats, each with a bar in the color of the --type-1 variable around it. */
export function BaseStats({ stats, className }: { stats: Stats; className?: string }) {
  return (
    <dl className={cn('flex flex-col gap-1 text-xs', className)}>
      {STATS.map((stat) => (
        <div key={stat} className="flex items-center gap-2">
          <dt className="w-12 shrink-0 text-muted-foreground">{STAT_LABELS[stat]}</dt>
          <dd className="flex flex-1 items-center gap-2">
            <Progress
              aria-hidden="true"
              value={(stats[stat] / MAX_BASE_STAT) * 100}
              className="*:data-[slot=progress-indicator]:bg-(--type-1)"
            />
            <span className="w-6 text-right tabular-nums">{stats[stat]}</span>
          </dd>
        </div>
      ))}
    </dl>
  )
}
