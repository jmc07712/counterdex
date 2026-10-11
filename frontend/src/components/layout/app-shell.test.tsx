import { fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { holdNextCurrentUser, serveSession } from '@/test/handlers'
import { renderWithProviders } from '@/test/render'
import { ASH } from '@/test/users'

import { AppShell } from './app-shell'

// Both the desktop header and the phone tab bar are in the DOM (CSS decides which is shown),
// so every section appears twice.
describe('AppShell navigation', () => {
  beforeEach(() => {
    serveSession()
  })

  it.each([
    ['/', 'Teams'],
    ['/teams/42', 'Teams'],
    ['/teams/42/edit', 'Teams'],
    ['/explore', 'Explore'],
    ['/pokedex', 'Pokédex'],
    ['/sign-in', 'Sign in'],
  ])('at %s, marks only %s as the current page', async (path, section) => {
    renderWithProviders(<AppShell />, { path })

    await screen.findAllByRole('link', { name: 'Sign in' })
    const current = screen.getAllByRole('link', { current: 'page' })
    expect(current.map((link) => link.textContent)).toEqual([section, section])
  })

  it.each([0, 1])('lists Teams first, then Explore, then the Pokédex (navigation %i)', (nav) => {
    renderWithProviders(<AppShell />)

    const navigation = screen.getAllByRole('navigation', { name: 'Primary' })[nav]
    const links = within(navigation).getAllByRole('link').map((link) => link.textContent)
    expect(links.slice(0, 3)).toEqual(['Teams', 'Explore', 'Pokédex'])
  })

  it('links to the API docs, which open in a new tab outside the app', () => {
    renderWithProviders(<AppShell />)

    const links = screen.getAllByRole('link', { name: 'API (opens in a new tab)' })

    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/api/docs')
      expect(link).toHaveAttribute('target', '_blank')
    }
  })
})

describe('AppShell account', () => {
  it('shows neither Sign in nor the account until it knows who’s signed in', () => {
    holdNextCurrentUser(null)

    renderWithProviders(<AppShell />)

    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Account/ })).not.toBeInTheDocument()
  })

  it.each([
    ['/teams/42', '/sign-in?next=%2Fteams%2F42'],
    ['/pokedex?q=char', '/sign-in?next=%2Fpokedex%3Fq%3Dchar'],
    ['/sign-up?next=/teams/42', '/sign-in?next=%2Fteams%2F42'],
    ['/sign-in', '/sign-in'],
  ])('at %s, signing in leads back to the same place: %s', async (path, href) => {
    serveSession()

    renderWithProviders(<AppShell />, { path })

    for (const link of await screen.findAllByRole('link', { name: 'Sign in' })) {
      expect(link).toHaveAttribute('href', href)
    }
  })

  it('shows who’s signed in, in place of signing in', async () => {
    serveSession({ signedIn: ASH })

    renderWithProviders(<AppShell />)

    expect(await screen.findAllByRole('button', { name: 'Account: ash' })).toHaveLength(2)
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
  })

  it('signs out from the account menu, and keeps keyboard focus on the page', async () => {
    const requests = serveSession({ signedIn: ASH })
    const { user } = renderWithProviders(<AppShell />)

    const [account] = await screen.findAllByRole('button', { name: 'Account: ash' })
    account.focus()
    await user.keyboard('{Enter}')
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('Signed in as ash')).toBeInTheDocument()
    await user.click(within(menu).getByRole('menuitem', { name: 'Sign out' }))

    expect(await screen.findAllByRole('link', { name: 'Sign in' })).toHaveLength(2)
    expect(requests.signOuts).toBe(1)
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('says when signing out fails, and stays signed in', async () => {
    serveSession({ signedIn: ASH, refuse: { signOut: 500 } })
    const { user } = renderWithProviders(<AppShell />)

    const [account] = await screen.findAllByRole('button', { name: 'Account: ash' })
    await user.click(account)
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t sign out. Try again.')
    await user.keyboard('{Escape}')
    expect(screen.getAllByRole('button', { name: 'Account: ash' })).toHaveLength(2)
  })
})

describe('AppShell tab bar', () => {
  beforeEach(() => {
    serveSession()
  })

  // The unstubGlobals config puts the scroll position back after each test.
  function scrollTo(y: number) {
    vi.stubGlobal('scrollY', y)
    fireEvent.scroll(window)
  }

  // The header's nav comes first; the phone tab bar second.
  function tabBar() {
    return screen.getAllByRole('navigation', { name: 'Primary' })[1]
  }

  it('gets out of the way while scrolling down and comes back on scrolling up', () => {
    renderWithProviders(<AppShell />)
    expect(tabBar()).toHaveAttribute('data-state', 'shown')

    scrollTo(400)
    expect(tabBar()).toHaveAttribute('data-state', 'hidden')

    // One step up, as a mouse wheel's click or Page Up makes, is enough.
    scrollTo(200)
    expect(tabBar()).toHaveAttribute('data-state', 'shown')
  })

  it('stays in view near the top of the page', () => {
    renderWithProviders(<AppShell />)

    scrollTo(40)

    expect(tabBar()).toHaveAttribute('data-state', 'shown')
  })
})
