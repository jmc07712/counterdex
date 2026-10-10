import { useQuery } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { Info } from 'lucide-react'

import { SyncStatus, type SyncRunSummary } from '@/api'
import { syncStatusOptions } from '@/api/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

// What the latest sync did, in the order shown. A Record, so each count has a label.
const RUN_COUNT_LABELS: Record<Exclude<keyof SyncRunSummary, `${string}_at` | 'status'>, string> = {
  inserted: 'New',
  updated: 'Updated',
  removed: 'Removed',
  restored: 'Restored',
  failed: 'Couldn’t sync',
}
const RUN_COUNTS = Object.keys(RUN_COUNT_LABELS) as (keyof typeof RUN_COUNT_LABELS)[]

/** A status light for the Pokédex data, with the latest sync's details a click away. */
export function SyncIndicator() {
  const { data } = useQuery(syncStatusOptions())

  if (!data?.last_synced_at) return null
  const syncedAt = new Date(data.last_synced_at)
  const age = formatDistanceToNow(syncedAt, { addSuffix: true })
  const run = data.latest_run
  const failed = run?.status === SyncStatus.FAILED

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 rounded-full">
          <StatusLight failed={failed} />
          {failed ? 'Last sync failed' : `Synced ${age}`}
          {/* Says there's more to see, which a status pill alone doesn't. */}
          <Info className="text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <PopoverHeader>
          <PopoverTitle>Pokédex data</PopoverTitle>
          <PopoverDescription>
            {failed
              ? `The latest sync with PokéAPI failed, so this is the data from ${age}.`
              : `Synced with PokéAPI ${age}.`}
          </PopoverDescription>
        </PopoverHeader>
        <time dateTime={data.last_synced_at} className="text-sm">
          {format(syncedAt, 'PPpp')}
        </time>
        {run && (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t pt-3 text-sm">
            {RUN_COUNTS.map((count) => (
              <div key={count} className="contents">
                <dt className="text-muted-foreground">{RUN_COUNT_LABELS[count]}</dt>
                <dd className="text-right tabular-nums">{run[count]}</dd>
              </div>
            ))}
          </dl>
        )}
      </PopoverContent>
    </Popover>
  )
}

// The Pokédex's green LED, softly pulsing while all is well; yellow when the last sync failed.
function StatusLight({ failed }: { failed: boolean }) {
  return (
    <span aria-hidden="true" className="relative flex size-2">
      {!failed && (
        <span className="absolute inset-0 rounded-full bg-led-green opacity-60 motion-safe:animate-ping" />
      )}
      <span className={cn('relative size-2 rounded-full', failed ? 'bg-led-yellow' : 'bg-led-green')} />
    </span>
  )
}
