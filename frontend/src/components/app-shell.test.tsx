import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'

import { AppShell } from '@/components/app-shell'

function renderAt(path: string) {
  const router = createMemoryRouter(
    [{ Component: AppShell, children: [{ path: '*', element: <p>page</p> }] }],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
}

describe('AppShell navigation', () => {
  it('marks only the current section as the current page', () => {
    renderAt('/teams/42')

    const [headerNav] = screen.getAllByRole('navigation', { name: 'Primary' })
    expect(within(headerNav).getByRole('link', { name: 'Teams' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(headerNav).getByRole('link', { name: 'Pokédex' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('does not mark the Pokédex as current on other pages', () => {
    renderAt('/sign-in')

    for (const link of screen.getAllByRole('link', { name: 'Pokédex' })) {
      expect(link).not.toHaveAttribute('aria-current')
    }
  })
})
