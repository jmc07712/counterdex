import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SyncOverview, SyncRunSummary } from '@/api'
import { serveSyncStatus } from '@/test/handlers'
import { renderWithProviders } from '@/test/render'

import { SyncChangesBanner } from './sync-changes-banner'
import { SyncIndicator } from './sync-indicator'

const NOW = new Date('2026-10-11T12:00:00Z')
const AN_HOUR_AGO = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString()
const BANNER = 'What the latest sync changed'

// Only Date is faked, so Testing Library's waits and user-event keep their real timers.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

// The banner beside the header's sync status, which shows once the status has loaded, so the
// banner's absence can be told from the status not having loaded yet.
function renderWithStatus() {
  const view = renderWithProviders(
    <>
      <SyncIndicator />
      <SyncChangesBanner />
    </>,
  )
  return { ...view, loaded: () => screen.findByRole('button', { name: /^Synced/ }) }
}

// The Pokédex as synced an hour ago, or at `finished_at`, by a run with `changes`.
function synced(changes: Partial<SyncRunSummary> = {}): SyncOverview {
  const finished = changes.finished_at ?? AN_HOUR_AGO
  return {
    last_synced_at: finished,
    latest_run: {
      status: 'succeeded',
      started_at: finished,
      finished_at: finished,
      inserted: 0,
      updated: 0,
      removed: 0,
      restored: 0,
      failed: 0,
      ...changes,
    },
  }
}

describe('SyncChangesBanner', () => {
  it('says what the latest sync changed, with a link to the changed Pokémon', async () => {
    serveSyncStatus(synced({ inserted: 1, updated: 4 }))

    renderWithProviders(<SyncChangesBanner />)

    const banner = await screen.findByRole('complementary', { name: BANNER })
    expect(banner).toHaveTextContent('The latest sync changed 5 Pokémon: 1 new and 4 updated.')
    expect(screen.getByRole('link', { name: 'See what changed' })).toHaveAttribute(
      'href',
      '/pokedex?status=changed',
    )
  })

  it('isn’t there when the latest sync changed nothing', async () => {
    serveSyncStatus(synced())

    await renderWithStatus().loaded()

    expect(screen.queryByRole('complementary', { name: BANNER })).not.toBeInTheDocument()
  })

  it('stays dismissed until a later sync changes more', async () => {
    serveSyncStatus(synced({ updated: 4 }))
    const { user, unmount } = renderWithProviders(<SyncChangesBanner />)

    await user.click(await screen.findByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByRole('complementary', { name: BANNER })).not.toBeInTheDocument()
    unmount()

    serveSyncStatus(synced({ updated: 4 }))
    const again = renderWithStatus()
    await again.loaded()
    expect(screen.queryByRole('complementary', { name: BANNER })).not.toBeInTheDocument()
    again.unmount()

    serveSyncStatus(synced({ removed: 1, finished_at: NOW.toISOString() }))
    renderWithProviders(<SyncChangesBanner />)
    expect(await screen.findByRole('complementary', { name: BANNER })).toHaveTextContent(
      '1 removed',
    )
  })
})
