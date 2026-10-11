import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import {
  resetIntersectionMocking,
  setupIntersectionMocking,
} from 'react-intersection-observer/test-utils'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'

import { client } from '@/api/client.gen'

import { server } from './server'

// jsdom doesn't implement matchMedia; every query is false, as on a phone in light mode. This is
// defined directly rather than with vi.stubGlobal, because the unstubGlobals config would remove a
// stub after the first test. Tests that need other answers stub their own with vi.stubGlobal.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
})

// jsdom doesn't lay pages out, so it has no scrolling to do.
Element.prototype.scrollIntoView = () => {}

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
