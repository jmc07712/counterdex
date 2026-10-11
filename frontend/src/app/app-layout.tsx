import { AppShell } from '@/components/layout/app-shell'
import { SyncIndicator } from '@/features/sync-status/components/sync-indicator'

/** The app shell around every page, with the Pokédex's sync status in its header. */
export function AppLayout() {
  return <AppShell status={<SyncIndicator />} />
}
