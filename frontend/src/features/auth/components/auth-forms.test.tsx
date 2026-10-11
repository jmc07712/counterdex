import { screen, waitFor } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { delay, http } from 'msw'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { serveSession } from '@/test/handlers'
import { renderWithProviders } from '@/test/render'
import { server } from '@/test/server'
import { ASH_CREDENTIALS } from '@/test/users'

import { SignInForm } from './sign-in-form'
import { SignUpForm } from './sign-up-form'
import { SignedOutOnly } from './signed-out-only'

// Each page as the router has it, and anywhere else a stand-in, to see where signing in leads.
function renderAt(path: string) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/sign-in"
        element={
          <SignedOutOnly>
            <SignInForm />
          </SignedOutOnly>
        }
      />
      <Route
        path="/sign-up"
        element={
          <SignedOutOnly>
            <SignUpForm />
          </SignedOutOnly>
        }
      />
      <Route path="*" element={<p>Somewhere else</p>} />
    </Routes>,
    { path },
  )
}

// Fills in the form, once it shows, and presses `button`.
async function fillIn(
  user: UserEvent,
  button: string,
  { username, password } = ASH_CREDENTIALS,
) {
  await user.type(await screen.findByLabelText('Username'), username)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: button }))
}

describe('SignInForm and SignUpForm', () => {
  describe('signing in', () => {
    it('signs in, then goes where it was asked to', async () => {
      const requests = serveSession()
      const { user, router } = renderAt('/sign-in?next=/teams/42')

      await fillIn(user, 'Sign in')

      expect(await screen.findByText('Somewhere else')).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/teams/42')
      expect(requests.signIns).toEqual([ASH_CREDENTIALS])
    })

    it('leaves out a space a phone keyboard adds after the username', async () => {
      const requests = serveSession()
      const { user } = renderAt('/sign-in')

      await fillIn(user, 'Sign in', { ...ASH_CREDENTIALS, username: 'ash ' })

      await screen.findByText('Somewhere else')
      expect(requests.signIns).toEqual([ASH_CREDENTIALS])
    })

    it.each([
      [401, 'Wrong username or password.'],
      [422, 'Check the username and password, then try again.'],
      [500, 'Something went wrong. Try again in a moment.'],
    ])('says what went wrong when the API answers %i', async (status, message) => {
      serveSession({ refuse: { signIn: status } })
      const { user } = renderAt('/sign-in')

      await fillIn(user, 'Sign in')

      expect(await screen.findByRole('alert')).toHaveTextContent(message)
    })

    it('says it’s signing in, keeps focus, and doesn’t send twice', async () => {
      serveSession()
      let sent = 0
      server.use(
        http.post('/api/session', async () => {
          sent += 1
          await delay('infinite')
        }),
      )
      const { user } = renderAt('/sign-in')

      await fillIn(user, 'Sign in')
      const button = await screen.findByRole('button', { name: 'Signing in…' })
      await user.click(button)

      expect(button).toHaveAttribute('aria-disabled', 'true')
      expect(button).toHaveFocus()
      expect(sent).toBe(1)
    })

    it.each([
      '//elsewhere.example',
      '/\\elsewhere.example',
      '/\t/elsewhere.example',
      '/\n/elsewhere.example',
      'https://elsewhere.example',
    ])('goes to Teams instead of leaving the app for next=%j', async (next) => {
      serveSession()
      const { user, router } = renderAt(`/sign-in?next=${encodeURIComponent(next)}`)

      await fillIn(user, 'Sign in')

      await screen.findByText('Somewhere else')
      expect(router.state.location.pathname).toBe('/teams')
    })

    it('checks only the lengths no account can go over', async () => {
      serveSession()
      renderAt('/sign-in')

      const username = await screen.findByLabelText('Username')
      expect(username).toHaveAttribute('maxlength', '32')
      expect(username).not.toHaveAttribute('minlength')
      expect(username).not.toHaveAttribute('pattern')
      expect(screen.getByLabelText('Password')).toHaveAttribute('maxlength', '128')
      expect(screen.getByLabelText('Password')).not.toHaveAttribute('minlength')
    })

    it.each([
      ['/sign-in?next=/teams/42', '/sign-up?next=%2Fteams%2F42'],
      ['/sign-in', '/sign-up'],
    ])('at %s, links to signing up at %s', async (path, href) => {
      serveSession()
      renderAt(path)

      expect(await screen.findByRole('link', { name: 'Create an account' })).toHaveAttribute(
        'href',
        href,
      )
    })
  })

  describe('signing up', () => {
    it('creates the account and signs in', async () => {
      const requests = serveSession()
      const { user, router } = renderAt('/sign-up')

      await fillIn(user, 'Create account')

      expect(await screen.findByText('Somewhere else')).toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/teams')
      expect(requests.signUps).toEqual([ASH_CREDENTIALS])
    })

    it('says when the username is taken, on the username, until it’s changed', async () => {
      serveSession({ refuse: { signUp: 409 } })
      const { user } = renderAt('/sign-up')

      await fillIn(user, 'Create account')

      const username = screen.getByLabelText('Username')
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Someone already has this username.',
      )
      expect(username).toHaveAttribute('aria-invalid', 'true')
      expect(username).toHaveAccessibleDescription(/Someone already has this username\./)

      await user.type(username, '-ketchum')

      expect(username).toHaveAttribute('aria-invalid', 'false')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('doesn’t send a username with characters it can’t have', async () => {
      const requests = serveSession()
      const { user } = renderAt('/sign-up')

      await fillIn(user, 'Create account', { ...ASH_CREDENTIALS, username: 'ash@kanto' })

      expect(screen.getByLabelText('Username')).toBeInvalid()
      await waitFor(() => expect(requests.signUps).toEqual([]))
    })

    it('has the browser hold back usernames and passwords of the wrong length', async () => {
      // Unlike browsers, jsdom doesn't hold back a value that's too short, so this checks the
      // browser is given the lengths.
      serveSession()
      renderAt('/sign-up')

      const username = await screen.findByLabelText('Username')
      expect(username).toHaveAttribute('minlength', '3')
      expect(username).toHaveAttribute('maxlength', '32')
      expect(screen.getByLabelText('Password')).toHaveAttribute('minlength', '8')
      expect(screen.getByLabelText('Password')).toHaveAttribute('maxlength', '128')
    })

    it('says what makes a good username and password', async () => {
      serveSession()
      renderAt('/sign-up')

      expect(await screen.findByLabelText('Username')).toHaveAccessibleDescription(
        '3 to 32 letters, numbers, underscores or hyphens.',
      )
      expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
        'At least 8 characters.',
      )
    })
  })
})
