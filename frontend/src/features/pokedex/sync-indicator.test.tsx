import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { SyncOverview, SyncRunSummary } from '@/api'
import { server } from '@/test/server'

import { SyncIndicator } from './sync-indicator'

const THREE_HOURS_AGO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

function makeRun(overrides: Partial<SyncRunSummary> = {}): SyncRunSummary {
  return {
    status: 'succeeded',
    started_at: THREE_HOURS_AGO,
    finished_at: THREE_HOURS_AGO,
    inserted: 0,
    updated: 2,
    removed: 1,
    restored: 0,
    failed: 0,
    ...overrides,
  }
}

// Answers with `overview`, and reports whether the request was made.
function serveSyncStatus(overview: SyncOverview) {
  const served = { requested: false }
  server.use(
    http.get('/api/sync/status', () => {
      served.requested = true
      return HttpResponse.json(overview)
    }),
  )
  return served
}

function renderIndicator() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <SyncIndicator />
    </QueryClientProvider>,
  )
}

describe('SyncIndicator', () => {
  it('says how long ago the Pokédex was synced', async () => {
    serveSyncStatus({ last_synced_at: THREE_HOURS_AGO, latest_run: makeRun() })

    renderIndicator()

    expect(
      await screen.findByRole('button', { name: 'Synced about 3 hours ago' }),
    ).toBeInTheDocument()
  })

  it('opens the details of the latest sync', async () => {
    serveSyncStatus({ last_synced_at: THREE_HOURS_AGO, latest_run: makeRun() })
    renderIndicator()

    await userEvent.setup().click(await screen.findByRole('button', { name: /Synced/ }))

    const details = await screen.findByRole('dialog')
    expect(within(details).getByText('Synced with PokéAPI about 3 hours ago.')).toBeInTheDocument()
    expect(within(details).getByText('Updated').nextElementSibling).toHaveTextContent('2')
    expect(within(details).getByText('Removed').nextElementSibling).toHaveTextContent('1')
    expect(within(details).getByRole('time')).toHaveAttribute('datetime', THREE_HOURS_AGO)
  })

  it('flags a failed sync, and says how old the data is', async () => {
    serveSyncStatus({
      last_synced_at: THREE_HOURS_AGO,
      latest_run: makeRun({ status: 'failed' }),
    })
    renderIndicator()

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Last sync failed' }))

    expect(
      within(await screen.findByRole('dialog')).getByText(
        'The latest sync with PokéAPI failed, so this is the data from about 3 hours ago.',
      ),
    ).toBeInTheDocument()
  })

  it('says nothing before the first sync', async () => {
    const served = serveSyncStatus({ last_synced_at: null, latest_run: null })

    const { container } = renderIndicator()

    await waitFor(() => expect(served.requested).toBe(true))
    expect(container).toBeEmptyDOMElement()
  })
})
