import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeSwitch } from '@/components/theme-switch'
import { THEME_STORAGE_KEY } from '@/lib/theme'

const root = document.documentElement

/** A controllable stand-in for the OS dark-mode setting (jsdom has no matchMedia). */
function mockSystemTheme(initiallyDark: boolean) {
  let matches = initiallyDark
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return matches
    },
    media: query,
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
      listeners.add(listener),
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
      listeners.delete(listener),
  }))
  return {
    setDark(dark: boolean) {
      matches = dark
      // Listeners only touch the DOM today; act() keeps this safe if they ever set React state.
      act(() => listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent)))
    },
  }
}

beforeEach(() => {
  mockSystemTheme(false)
})

afterEach(() => {
  // Stubbed globals and spies are restored by the unstubGlobals/restoreMocks config.
  root.classList.remove('dark')
  localStorage.clear()
})

describe('ThemeSwitch', () => {
  it('follows the system setting when nothing is saved', () => {
    mockSystemTheme(true)

    render(<ThemeSwitch />)

    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()
    expect(root).toHaveClass('dark')
  })

  it('selects and applies a saved choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    render(<ThemeSwitch />)

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked()
    expect(root).toHaveClass('dark')
  })

  it('treats an unrecognised saved value as System', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'blue')

    render(<ThemeSwitch />)

    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()
  })

  it('falls back to System when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })

    render(<ThemeSwitch />)

    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()
  })

  it('applies and remembers Dark', async () => {
    const user = userEvent.setup()
    render(<ThemeSwitch />)

    await user.click(screen.getByRole('radio', { name: 'Dark' }))

    expect(root).toHaveClass('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('applies and remembers Light even when the system is dark', async () => {
    mockSystemTheme(true)
    const user = userEvent.setup()
    render(<ThemeSwitch />)
    expect(root).toHaveClass('dark')

    await user.click(screen.getByRole('radio', { name: 'Light' }))

    expect(root).not.toHaveClass('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('forgets the saved choice when switching back to System', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    const user = userEvent.setup()
    render(<ThemeSwitch />)

    await user.click(screen.getByRole('radio', { name: 'System' }))

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(root).not.toHaveClass('dark')
  })

  it('tracks system changes live while set to System', () => {
    const system = mockSystemTheme(false)
    render(<ThemeSwitch />)

    system.setDark(true)
    expect(root).toHaveClass('dark')

    system.setDark(false)
    expect(root).not.toHaveClass('dark')
  })

  it('ignores system changes when a choice is saved', () => {
    const system = mockSystemTheme(false)
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    render(<ThemeSwitch />)

    system.setDark(true)

    expect(root).not.toHaveClass('dark')
  })

  it('stops tracking the system after a choice is made', async () => {
    const system = mockSystemTheme(false)
    const user = userEvent.setup()
    render(<ThemeSwitch />)

    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    system.setDark(false)

    expect(root).toHaveClass('dark')
  })

  it('can be operated with the keyboard alone', async () => {
    const user = userEvent.setup()
    render(<ThemeSwitch />)

    await user.tab()
    expect(screen.getByRole('radio', { name: 'System' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked()
    expect(root).toHaveClass('dark')
  })
})
