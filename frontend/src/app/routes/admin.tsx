import { PageHeader } from '@/components/layout/page-header'
import { AdminOnly } from '@/features/admin/components/admin-only'
import { SyncRunsCard } from '@/features/admin/components/sync-runs-card'
import { m } from '@/paraglide/messages.js'

export function AdminPage() {
  return (
    <>
      <PageHeader title={m.admin_title()} description={m.admin_description()} />
      <AdminOnly>
        <div className="grid gap-6">
          <SyncRunsCard />
        </div>
      </AdminOnly>
    </>
  )
}
