import { Info } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { SyncStatus } from '@/api'
import { ChangedIcon } from '@/components/pokemon/changed-mark'
import { LiveStatusLight, StatusLight } from '@/components/sync/status-light'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { paths } from '@/config/paths'
import { formatAge, formatDateTime, formatShortAge } from '@/lib/dates'
import { m } from '@/paraglide/messages.js'

import { useSyncStatus } from '../hooks/use-sync-status'
import { recentChanges } from '../utils/recent-changes'

export function SyncIndicator() {
  const { data } = useSyncStatus()
  const [open, setOpen] = useState(false)

  if (!data?.last_synced_at) return null
  const syncedAt = new Date(data.last_synced_at)
  const age = formatAge(syncedAt)
  const run = data.latest_run
  const failed = run?.status === SyncStatus.FAILED
  const changed = recentChanges(data) !== null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 rounded-full">
          {failed ? <StatusLight failed /> : <LiveStatusLight />}
          {/* Marks a sync with changes in the last week; the banner under the header says what. */}
          {changed && <ChangedIcon />}
          {/* Below lg the header only has room for the light and a word or a short age. The full
              words are still read out. */}
          <span className="max-lg:sr-only">
            {failed ? m.sync_last_failed() : m.sync_synced_ago({ ago: age })}
          </span>
          <span aria-hidden="true" className="tabular-nums lg:hidden">
            {failed ? m.sync_failed_short() : formatShortAge(syncedAt)}
          </span>
          <Info className="text-muted-foreground max-lg:hidden" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <PopoverHeader>
          <PopoverTitle>{m.sync_title()}</PopoverTitle>
          <PopoverDescription>
            {failed
              ? m.sync_failed_description({ ago: age })
              : m.sync_succeeded_description({ ago: age })}
          </PopoverDescription>
        </PopoverHeader>
        <time dateTime={data.last_synced_at} className="text-sm">
          {formatDateTime(syncedAt)}
        </time>
        {run && (
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t pt-3 text-sm">
            <Count label={m.sync_inserted()} value={run.inserted} />
            <Count label={m.sync_updated()} value={run.updated} />
            <Count label={m.sync_removed()} value={run.removed} />
            <Count label={m.sync_restored()} value={run.restored} />
            <Count label={m.sync_failed()} value={run.failed} />
          </dl>
        )}
        {changed && (
          <Link
            to={paths.pokedex.getHref({ status: 'changed' })}
            onClick={() => setOpen(false)}
            className="flex items-center gap-1.5 rounded-sm text-sm font-semibold underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ChangedIcon />
            {m.sync_changes_link()}
          </Link>
        )}
      </PopoverContent>
    </Popover>
  )
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  )
}
