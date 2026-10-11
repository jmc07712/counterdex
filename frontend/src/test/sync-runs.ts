import { type SyncRunDetails, SyncStatus } from '@/api'

/** A sync that ran for 2 minutes 5 seconds and changed a few Pokémon, with `overrides`. */
export function makeSyncRun(overrides: Partial<SyncRunDetails> = {}): SyncRunDetails {
  return {
    id: 1,
    started_at: '2026-10-10T09:00:00Z',
    finished_at: '2026-10-10T09:02:05Z',
    status: SyncStatus.SUCCEEDED,
    fetched: 1302,
    inserted: 4,
    updated: 3,
    unchanged: 1292,
    removed: 2,
    restored: 1,
    failed_count: 0,
    error: null,
    ...overrides,
  }
}

/** `count` runs, newest first as the API lists them: run `count` down to run 1, a day apart. */
export function makeSyncRuns(count: number): SyncRunDetails[] {
  return Array.from({ length: count }, (_, index) => {
    const id = count - index
    const day = `${id}`.padStart(2, '0')
    return makeSyncRun({
      id,
      started_at: `2026-09-${day}T09:00:00Z`,
      finished_at: `2026-09-${day}T09:02:05Z`,
    })
  })
}
