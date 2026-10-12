import { vi } from 'vitest'

/** Answers matchMedia as a screen that matches only `query` would, over setup.ts's phone. */
export function stubMatchMedia(query: string) {
  vi.stubGlobal('matchMedia', (asked: string) => ({
    matches: asked === query,
    media: asked,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

/** A screen as wide as Tailwind's lg breakpoint, where the Pokédex is beside the team it edits. */
export function onWideScreen() {
  stubMatchMedia('(min-width: 64rem)')
}

/** A touch screen, whose pointer is coarse, as a phone's is. */
export function onTouchScreen() {
  stubMatchMedia('(pointer: coarse)')
}
