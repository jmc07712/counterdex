import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { serveSession, serveSyncStatus } from '@/test/handlers'
import { renderWithProviders } from '@/test/render'

import { AppLayout } from './app-layout'

const THREE_HOURS_AGO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

describe('AppLayout', () => {
  beforeEach(() => {
    serveSession()
    serveSyncStatus({ last_synced_at: THREE_HOURS_AGO, latest_run: null })
  })

  it.each(['/', '/explore', '/teams/42'])(
    'shows how fresh the Pokédex data is in the header, at %s',
    async (path) => {
      renderWithProviders(<AppLayout />, { path })

      expect(
        await screen.findByRole('button', { name: 'Synced about 3 hours ago' }),
      ).toBeInTheDocument()
    },
  )
})
