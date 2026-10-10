import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import type { SyncOverview } from '@/api'
import { server } from '@/test/server'

import { LastSynced } from './last-synced'

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

function renderLastSynced() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <LastSynced />
    </QueryClientProvider>,
  )
}

describe('LastSynced', () => {
  it('says how long ago the Pokédex was synced, with the exact time on hover', async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    serveSyncStatus({ last_synced_at: threeHoursAgo, latest_run: null })

    renderLastSynced()

    const time = await screen.findByText('about 3 hours ago')
    expect(time.closest('p')).toHaveTextContent('Synced with PokéAPI about 3 hours ago')
    expect(time).toHaveAttribute('datetime', threeHoursAgo)
    expect(time).toHaveAttribute('title')
  })

  it('says nothing before the first sync', async () => {
    const served = serveSyncStatus({ last_synced_at: null, latest_run: null })

    const { container } = renderLastSynced()

    await waitFor(() => expect(served.requested).toBe(true))
    expect(container).toBeEmptyDOMElement()
  })
})
