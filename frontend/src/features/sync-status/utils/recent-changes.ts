import { type SyncOverview, type SyncRunSummary, SyncStatus } from '@/api'
import { andList } from '@/lib/lists'
import { m } from '@/paraglide/messages.js'

// How long a sync's changes count as recent, as the API's RECENTLY_CHANGED.
const RECENT_MS = 7 * 24 * 60 * 60 * 1000

/**
 * The latest sync, if it succeeded in the last week and added, updated, removed or restored any
 * Pokémon. Null otherwise, as when it failed or changed nothing.
 */
export function recentChanges(
  overview: SyncOverview | undefined,
  now = new Date(),
): SyncRunSummary | null {
  const run = overview?.latest_run
  if (!run || run.status !== SyncStatus.SUCCEEDED) return null
  if (now.getTime() - new Date(run.finished_at).getTime() > RECENT_MS) return null
  return changedCount(run) > 0 ? run : null
}

/**
 * What a sync changed, in a sentence: "The latest sync changed 12 Pokémon: 3 new, 8 updated and
 * 1 removed." Kinds it changed none of are left out.
 */
export function changesSentence(run: SyncRunSummary) {
  const parts = [
    run.inserted > 0 && m.sync_changes_new({ count: run.inserted }),
    run.updated > 0 && m.sync_changes_updated({ count: run.updated }),
    run.removed > 0 && m.sync_changes_removed({ count: run.removed }),
    run.restored > 0 && m.sync_changes_restored({ count: run.restored }),
  ].filter((part) => part !== false)
  return m.sync_changes({ count: changedCount(run), parts: andList(parts) })
}

function changedCount(run: SyncRunSummary) {
  return run.inserted + run.updated + run.removed + run.restored
}
