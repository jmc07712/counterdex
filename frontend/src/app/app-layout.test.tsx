import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { serveSession } from '@/test/handlers/session'
import { serveSyncStatus } from '@/test/handlers/sync'
import { serveTeams } from '@/test/handlers/teams'
import { renderRoutes } from '@/test/render'

import { routes } from './router'

const THREE_HOURS_AGO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

describe('AppLayout', () => {
  beforeEach(() => {
    serveSession()
    serveTeams()
    serveSyncStatus({ last_synced_at: THREE_HOURS_AGO, latest_run: null })
  })

  it.each(['/', '/teams/42', '/sign-in'])(
    'shows how fresh the Pokédex data is in the header at %s',
    async (path) => {
      renderRoutes(routes, { path })

      const header = screen.getByRole('banner')
      expect(
        await within(header).findByRole('button', { name: 'Synced about 3 hours ago' }),
      ).toBeInTheDocument()
    },
  )
})
