import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { serveSession } from '@/test/handlers'
import { renderWithProviders } from '@/test/render'

import { TeamsPage } from './teams'

describe('TeamsPage', () => {
  it('asks someone signed out to sign in or sign up, then come back', async () => {
    serveSession()

    renderWithProviders(<TeamsPage />, { path: '/' })

    expect(await screen.findByText('Sign in to build teams')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in?next=%2F',
    )
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/sign-up?next=%2F',
    )
  })

  it('says when it couldn’t check who’s signed in, rather than asking to sign in', async () => {
    const requests = serveSession({ refuse: { currentUser: 500 } })
    const { user } = renderWithProviders(<TeamsPage />, { path: '/' })

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Couldn’t check whether you’re signed in',
    )
    expect(screen.queryByText('Sign in to build teams')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(requests.checks).toBe(2))
  })
})
