import { render, screen } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { describe, expect, it } from 'vitest'

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
})
