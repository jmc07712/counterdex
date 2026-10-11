import { SyncStatus } from '@/api'
import { StatusLight } from '@/components/sync/status-light'
import { m } from '@/paraglide/messages.js'

/** How a sync run went, as its light and in words. */
export function RunStatus({ status }: { status: SyncStatus }) {
  return (
    <span className="inline-flex items-center gap-2">
      <StatusLight failed={status === SyncStatus.FAILED} />
      {m.admin_run_status({ status })}
    </span>
  )
}
