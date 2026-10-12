import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { holdNextCurrentUser, serveSession } from '@/test/handlers/session'
import { renderWithProviders } from '@/test/render'
import { ASH } from '@/test/users'

import { SignedOutOnly } from './signed-out-only'

function renderAt(path: string) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/sign-in"
        element={
          <SignedOutOnly>
            <p>The sign-in form</p>
          </SignedOutOnly>
        }
      />
      <Route path="*" element={<p>Somewhere else</p>} />
    </Routes>,
    { path },
  )
}

describe('SignedOutOnly', () => {
  it('shows nothing until it knows who’s signed in', () => {
    holdNextCurrentUser(null)

    renderAt('/sign-in')

    expect(screen.queryByText('The sign-in form')).not.toBeInTheDocument()
  })

  it('shows its page to someone signed out', async () => {
    serveSession()

    renderAt('/sign-in')

    expect(await screen.findByText('The sign-in form')).toBeInTheDocument()
  })

  it.each([
    ['/sign-in?next=/teams/42', '/teams/42'],
    ['/sign-in', '/'],
  ])('sends someone signed in on from %s to %s', async (path, next) => {
    serveSession({ signedIn: ASH })

    const { router } = renderAt(path)

    expect(await screen.findByText('Somewhere else')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe(next)
  })
})
