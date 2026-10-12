import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { serveSession } from '@/test/handlers/session'
import { serveSyncStatus } from '@/test/handlers/sync'
import { serveTeams } from '@/test/handlers/teams'
import { renderRoutes } from '@/test/render'

import { routes } from './router'

describe('routes', () => {
  beforeEach(() => {
    serveSession()
    serveSyncStatus()
    serveTeams()
  })

  it.each([
    ['the Teams page', '/', 'Teams'],
    ['the Admin page', '/admin', 'Admin'],
    ['Page not found', '/explore', 'Page not found'],
  ])('shows %s at %s', async (_, path, heading) => {
    renderRoutes(routes, { path })

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })
})
