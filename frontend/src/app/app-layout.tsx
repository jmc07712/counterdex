import { AppShell } from '@/components/layout/app-shell'
import { SyncChangesBanner } from '@/features/sync-status/components/sync-changes-banner'
import { SyncIndicator } from '@/features/sync-status/components/sync-indicator'

/**
 * The app shell around every page, with the Pokédex's sync status in its header and what the
 * latest sync changed under it.
 */
export function AppLayout() {
  return <AppShell status={<SyncIndicator />} banner={<SyncChangesBanner />} />
}
