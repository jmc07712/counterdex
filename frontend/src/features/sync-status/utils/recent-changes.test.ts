import { describe, expect, it } from 'vitest'

import type { SyncOverview, SyncRunSummary } from '@/api'

import { changesSentence, recentChanges } from './recent-changes'

const NOW = new Date('2026-10-11T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

function run(changes: Partial<SyncRunSummary> = {}): SyncRunSummary {
  const finished = new Date(NOW.getTime() - DAY).toISOString()
  return {
    status: 'succeeded',
    started_at: finished,
    finished_at: finished,
    inserted: 0,
    updated: 0,
    removed: 0,
    restored: 0,
    failed: 0,
    ...changes,
  }
}

function overview(latest: SyncRunSummary | null): SyncOverview {
  return { last_synced_at: latest?.finished_at ?? null, latest_run: latest }
}

describe('recentChanges', () => {
  it('is the latest sync if it changed any Pokémon in the last week', () => {
    const latest = run({ updated: 2 })

    expect(recentChanges(overview(latest), NOW)).toBe(latest)
  })

  it('is null if the latest sync changed nothing, failed or was over a week ago', () => {
    const weekAndADayAgo = new Date(NOW.getTime() - 8 * DAY).toISOString()

    expect(recentChanges(overview(run()), NOW)).toBeNull()
    expect(recentChanges(overview(run({ status: 'failed', updated: 2 })), NOW)).toBeNull()
    expect(recentChanges(overview(run({ updated: 2, finished_at: weekAndADayAgo })), NOW)).toBeNull()
    expect(recentChanges(overview(null), NOW)).toBeNull()
    expect(recentChanges(undefined, NOW)).toBeNull()
  })
})

describe('changesSentence', () => {
  it('counts each kind of change, leaving out those with none', () => {
    expect(changesSentence(run({ inserted: 3, updated: 8, removed: 1 }))).toBe(
      'The latest sync changed 12 Pokémon: 3 new, 8 updated and 1 removed.',
    )
  })

  it('names a single kind of change on its own', () => {
    expect(changesSentence(run({ restored: 2 }))).toBe(
      'The latest sync changed 2 Pokémon: 2 restored.',
    )
  })
})
