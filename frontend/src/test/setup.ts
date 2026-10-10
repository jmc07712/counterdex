import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

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

afterEach(() => {
  cleanup()
})
