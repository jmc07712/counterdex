import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '@/test/render'

import { AppShell } from './app-shell'

// Both the desktop header and the phone tab bar are in the DOM (CSS decides which is shown),
// so every section appears twice.
describe('AppShell navigation', () => {
  it.each([
    ['/teams/42', 'Teams'],
    ['/sign-in', 'Sign in'],
  ])('at %s, marks only %s as the current page', (path, section) => {
    renderWithProviders(<AppShell />, { path })

    const current = screen.getAllByRole('link', { current: 'page' })
    expect(current.map((link) => link.textContent)).toEqual([section, section])
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

describe('AppShell tab bar', () => {
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
