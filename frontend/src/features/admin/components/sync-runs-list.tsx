import type { ReactNode } from 'react'

import type { SyncRunDetails } from '@/api'
import { formatDateTime, formatDuration } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { RunError } from './run-error'
import { RunStatus } from './run-status'

type SyncRunsListProps = {
  runs: SyncRunDetails[]
  // The id of the heading that names the list.
  labelledBy: string
  // While the next page loads in place of these runs.
  busy: boolean
  className?: string
}

/** The runs as a list of cards, for screens too narrow for the table. */
export function SyncRunsList({ runs, labelledBy, busy, className }: SyncRunsListProps) {
  return (
    <ul
      aria-labelledby={labelledBy}
      aria-busy={busy}
      className={cn(
        'grid gap-3 transition-opacity duration-200 aria-busy:opacity-60 md:grid-cols-2',
        className,
      )}
    >
      {runs.map((run) => (
        <li key={run.id} className="flex min-w-0 flex-col gap-3 rounded-lg border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="font-medium">
              <RunStatus status={run.status} />
            </span>
            <time dateTime={run.started_at} className="text-xs text-muted-foreground">
              {formatDateTime(run.started_at)}
            </time>
          </div>
          {/* The same columns in every card, the first one wider for the duration. */}
          <dl className="grid grid-cols-[4fr_3fr_3fr] gap-x-3 gap-y-2">
            <Detail label={m.admin_runs_duration()}>
              {formatDuration(run.started_at, run.finished_at)}
            </Detail>
            <Detail label={m.sync_inserted()}>{run.inserted}</Detail>
            <Detail label={m.sync_updated()}>{run.updated}</Detail>
            <Detail label={m.sync_removed()}>{run.removed}</Detail>
            <Detail label={m.sync_restored()}>{run.restored}</Detail>
            <Detail label={m.sync_failed()}>{run.failed_count}</Detail>
          </dl>
          {run.error && (
            <div className="-mx-1.5 -mb-1">
              <RunError error={run.error} />
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  )
}
