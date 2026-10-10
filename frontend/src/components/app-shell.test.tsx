import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { afterEach, describe, expect, it } from 'vitest'

import { AppShell } from '@/components/app-shell'

function renderAt(path: string) {
  const router = createMemoryRouter(
    [{ Component: AppShell, children: [{ path: '*', element: <p>page</p> }] }],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
}

function currentPageLinks() {
  return screen.getAllByRole('link', { current: 'page' }).map((link) => link.textContent)
}

// Both the desktop header and the phone tab bar are in the DOM (CSS decides which is shown),
// so every section appears twice.
describe('AppShell navigation', () => {
  it('marks only the current section as the current page', () => {
    renderAt('/teams/42')

    expect(currentPageLinks()).toEqual(['Teams', 'Teams'])
  })

  it('does not mark the Pokédex as current on other pages', () => {
    renderAt('/sign-in')

    expect(currentPageLinks()).toEqual(['Sign in', 'Sign in'])
  })

  it('links to the API docs, which open in a new tab outside the app', () => {
    renderAt('/')

    const links = screen.getAllByRole('link', { name: 'API (opens in a new tab)' })

    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/api/docs')
      expect(link).toHaveAttribute('target', '_blank')
    }
  })
})

describe('AppShell tab bar', () => {
  afterEach(() => scrollTo(0))

  function scrollTo(y: number) {
    Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
    fireEvent.scroll(window)
  }

  // The header's nav comes first; the phone tab bar second.
  function tabBar() {
    return screen.getAllByRole('navigation', { name: 'Primary' })[1]
  }

  it('gets out of the way while scrolling down and comes back on scrolling up', () => {
    renderAt('/')
    expect(tabBar()).toHaveAttribute('data-state', 'shown')

    scrollTo(400)
    expect(tabBar()).toHaveAttribute('data-state', 'hidden')

    // One step up, as a mouse wheel's click or Page Up makes, is enough.
    scrollTo(200)
    expect(tabBar()).toHaveAttribute('data-state', 'shown')
  })

  it('stays in view near the top of the page', () => {
    renderAt('/')

    scrollTo(40)

    expect(tabBar()).toHaveAttribute('data-state', 'shown')
  })
})
