import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { SyncOverview, SyncRunSummary } from '@/api'
import { serveSyncStatus } from '@/test/handlers'
import { termsAndDefinitions } from '@/test/queries'
import { renderWithProviders } from '@/test/render'

import { SyncIndicator } from './sync-indicator'

const THREE_HOURS_AGO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

// The Pokédex as synced three hours ago, by a run like `run`.
function syncedThreeHoursAgo(run: Partial<SyncRunSummary> = {}): SyncOverview {
  return {
    last_synced_at: THREE_HOURS_AGO,
    latest_run: {
      status: 'succeeded',
      started_at: THREE_HOURS_AGO,
      finished_at: THREE_HOURS_AGO,
      inserted: 4,
      updated: 3,
      removed: 2,
      restored: 1,
      failed: 0,
      ...run,
    },
  }
}

describe('SyncIndicator', () => {
  it('says how long ago the Pokédex was synced', async () => {
    serveSyncStatus(syncedThreeHoursAgo())

    renderWithProviders(<SyncIndicator />)

    expect(
      await screen.findByRole('button', { name: 'Synced about 3 hours ago' }),
    ).toBeInTheDocument()
  })

  it('has a shorter age to show on small screens', async () => {
    serveSyncStatus(syncedThreeHoursAgo())

    renderWithProviders(<SyncIndicator />)

    const button = await screen.findByRole('button', { name: 'Synced about 3 hours ago' })
    expect(within(button).getByText('3h ago')).toBeInTheDocument()
  })

  it('says a sync failed in words on small screens too, not by color alone', async () => {
    serveSyncStatus(syncedThreeHoursAgo({ status: 'failed' }))

    renderWithProviders(<SyncIndicator />)

    const button = await screen.findByRole('button', { name: 'Last sync failed' })
    expect(within(button).getByText('Failed')).toBeInTheDocument()
  })

  it('opens the details of the latest sync', async () => {
    serveSyncStatus(syncedThreeHoursAgo())
    const { user } = renderWithProviders(<SyncIndicator />)

    await user.click(await screen.findByRole('button', { name: 'Synced about 3 hours ago' }))

    const details = await screen.findByRole('dialog')
    expect(within(details).getByText('Synced with PokéAPI about 3 hours ago.')).toBeInTheDocument()
    expect(within(details).getByRole('time')).toHaveAttribute('datetime', THREE_HOURS_AGO)
    expect(termsAndDefinitions(details)).toEqual([
      ['New', '4'],
      ['Updated', '3'],
      ['Removed', '2'],
      ['Restored', '1'],
      ['Couldn’t sync', '0'],
    ])
  })

  it('flags a failed sync, and says how old the data is', async () => {
    serveSyncStatus(syncedThreeHoursAgo({ status: 'failed' }))
    const { user } = renderWithProviders(<SyncIndicator />)

    await user.click(await screen.findByRole('button', { name: 'Last sync failed' }))

    expect(
      within(await screen.findByRole('dialog')).getByText(
        'The latest sync with PokéAPI failed, so this is the data from about 3 hours ago.',
      ),
    ).toBeInTheDocument()
  })

  it('says nothing before the first sync', async () => {
    const requests = serveSyncStatus({ last_synced_at: null, latest_run: null })

    const { container } = renderWithProviders(<SyncIndicator />)

    await waitFor(() => expect(requests).toHaveLength(1))
    expect(container).toBeEmptyDOMElement()
  })
})
