import type { SyncRunDetails } from '@/api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateTime, formatDuration } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { RunError } from './run-error'
import { RunStatus } from './run-status'

type SyncRunsTableProps = {
  runs: SyncRunDetails[]
  // The id of the heading that names the table.
  labelledBy: string
  // While the next page loads in place of these runs.
  busy: boolean
  className?: string
}

/** The runs as a table, a row each, for screens wide enough for every column. */
export function SyncRunsTable({ runs, labelledBy, busy, className }: SyncRunsTableProps) {
  return (
    <Table
      aria-labelledby={labelledBy}
      aria-busy={busy}
      className={cn('busy-fade', className)}
    >
      <TableHeader>
        <TableRow className="text-xs hover:bg-transparent">
          <TableHead scope="col">{m.admin_runs_status_heading()}</TableHead>
          <TableHead scope="col">{m.admin_runs_started()}</TableHead>
          <TableHead scope="col">{m.admin_runs_duration()}</TableHead>
          <TableHead scope="col" className="text-right">
            {m.sync_inserted()}
          </TableHead>
          <TableHead scope="col" className="text-right">
            {m.sync_updated()}
          </TableHead>
          <TableHead scope="col" className="text-right">
            {m.sync_removed()}
          </TableHead>
          <TableHead scope="col" className="text-right">
            {m.sync_restored()}
          </TableHead>
          <TableHead scope="col" className="text-right">
            {m.sync_failed()}
          </TableHead>
          <TableHead scope="col">{m.admin_runs_error()}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell>
              <RunStatus status={run.status} />
            </TableCell>
            {/* When it started tells the runs apart, so it heads the row. */}
            <TableHead scope="row" className="font-normal">
              <time dateTime={run.started_at}>{formatDateTime(run.started_at)}</time>
            </TableHead>
            <TableCell>{formatDuration(run.started_at, run.finished_at)}</TableCell>
            <TableCell className="text-right tabular-nums">{run.inserted}</TableCell>
            <TableCell className="text-right tabular-nums">{run.updated}</TableCell>
            <TableCell className="text-right tabular-nums">{run.removed}</TableCell>
            <TableCell className="text-right tabular-nums">{run.restored}</TableCell>
            <TableCell className="text-right tabular-nums">{run.failed_count}</TableCell>
            {/* Takes the width the other columns leave and no more, so the error is cut to fit. */}
            <TableCell className="w-full max-w-0 py-1">
              {run.error && <RunError error={run.error} />}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
