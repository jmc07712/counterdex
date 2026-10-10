import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement } from 'react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'

/**
 * Renders `ui` inside what the app gives every page: a query client and a router, here at `path`.
 * The query client is fresh, so no test sees another's data, and doesn't retry, so a failed
 * request fails at once. Returns the router, to check the URL, and a user-event `user`, set up
 * before rendering as user-event recommends.
 */
export function renderWithProviders(ui: ReactElement, { path = '/' } = {}) {
  const user = userEvent.setup()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: '*', element: ui }], { initialEntries: [path] })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { ...result, user, router }
}
