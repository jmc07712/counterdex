import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import {
  resetIntersectionMocking,
  setupIntersectionMocking,
} from 'react-intersection-observer/test-utils'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'

import { client } from '@/api/client.gen'
import { server } from '@/test/server'

// jsdom doesn't implement matchMedia; default to a light-mode OS. This is defined directly
// rather than with vi.stubGlobal, because the unstubGlobals config would remove a stub after
// the first test. Tests that care about the OS setting stub their own with vi.stubGlobal.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
})

// The app calls the API with relative URLs; Node's fetch needs an absolute one.
client.setConfig({ baseUrl: window.location.origin })

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

// jsdom has no IntersectionObserver; tests decide when elements scroll into view.
beforeEach(() => {
  setupIntersectionMocking(vi.fn)
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  resetIntersectionMocking()
})

afterAll(() => {
  server.close()
})
