import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactElement, ReactNode } from 'react'
import { createMemoryRouter, type RouteObject } from 'react-router'
import { RouterProvider } from 'react-router/dom'

import { queryDefaults } from '@/lib/query-client'

// The app's query client, fresh so no test sees another's data, and without retries so a failed
// request fails at once.
function testQueryClient() {
  return new QueryClient({
    defaultOptions: { ...queryDefaults, queries: { ...queryDefaults.queries, retry: false } },
  })
}

/**
 * Renders `ui` inside what the app gives every page: a query client and a router, here at `path`.
 * Returns the router, to check the URL; the query client, to wait for its requests to settle; and
 * a user-event `user`, set up before rendering as user-event recommends.
 */
export function renderWithProviders(ui: ReactElement, { path = '/' } = {}) {
  return renderRoutes([{ path: '*', element: ui }], { path })
}

/** Renders `routes`, such as the app's own, at `path`, as renderWithProviders renders a page. */
export function renderRoutes(routes: RouteObject[], { path = '/' } = {}) {
  const user = userEvent.setup()
  const queryClient = testQueryClient()
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { ...result, user, router, queryClient }
}

/** Runs `hook` inside a query client, as renderWithProviders renders a page. */
export function renderHookWithProviders<Result>(hook: () => Result) {
  const queryClient = testQueryClient()
  return renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
}
