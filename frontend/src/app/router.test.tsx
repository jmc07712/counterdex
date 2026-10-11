import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { serveSession, serveSyncStatus, serveTeams } from '@/test/handlers'
import { renderRoutes } from '@/test/render'

import { routes } from './router'

describe('routes', () => {
  beforeEach(() => {
    serveSession()
    serveSyncStatus()
    serveTeams()
  })

  it('shows the Teams page at /', async () => {
    renderRoutes(routes, { path: '/' })

    expect(await screen.findByRole('heading', { level: 1, name: 'Teams' })).toBeInTheDocument()
  })

  it('shows Page not found at /explore', async () => {
    renderRoutes(routes, { path: '/explore' })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
  })
})
