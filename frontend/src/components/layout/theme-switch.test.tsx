import { act, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { THEME_STORAGE_KEY } from '@/lib/theme'
import { renderWithProviders } from '@/test/render'

import { ThemeSwitch } from './theme-switch'

const root = document.documentElement

/** A controllable stand-in for the OS dark-mode setting, over setup.ts's fixed light one. */
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

afterEach(() => {
  // Stubbed globals and spies are restored by the unstubGlobals/restoreMocks config.
  root.classList.remove('dark')
  localStorage.clear()
})

describe('ThemeSwitch', () => {
  it('follows the system setting when nothing is saved', () => {
    mockSystemTheme(true)

    renderWithProviders(<ThemeSwitch />)

    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()
    expect(root).toHaveClass('dark')
  })

  it('selects and applies a saved choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    renderWithProviders(<ThemeSwitch />)

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked()
    expect(root).toHaveClass('dark')
  })

  it('treats an unrecognised saved value as System', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'blue')

    renderWithProviders(<ThemeSwitch />)

    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()
  })

  it('falls back to System when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked')
    })

    renderWithProviders(<ThemeSwitch />)

    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()
  })

  it.each([
    { choice: 'Dark', saved: 'dark', systemDark: false },
    { choice: 'Light', saved: 'light', systemDark: true },
  ])('applies and remembers $choice over the system setting', async (theme) => {
    mockSystemTheme(theme.systemDark)
    const { user } = renderWithProviders(<ThemeSwitch />)

    await user.click(screen.getByRole('radio', { name: theme.choice }))

    expect(root.classList.contains('dark')).toBe(theme.choice === 'Dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(theme.saved)
  })

  it('forgets the saved choice when switching back to System', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    const { user } = renderWithProviders(<ThemeSwitch />)

    await user.click(screen.getByRole('radio', { name: 'System' }))

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(root).not.toHaveClass('dark')
  })

  it('tracks system changes live while set to System', () => {
    const system = mockSystemTheme(false)
    renderWithProviders(<ThemeSwitch />)

    system.setDark(true)
    expect(root).toHaveClass('dark')

    system.setDark(false)
    expect(root).not.toHaveClass('dark')
  })

  it('ignores system changes when a choice is saved', () => {
    const system = mockSystemTheme(false)
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    renderWithProviders(<ThemeSwitch />)

    system.setDark(true)

    expect(root).not.toHaveClass('dark')
  })

  it('stops tracking the system after a choice is made', async () => {
    const system = mockSystemTheme(false)
    const { user } = renderWithProviders(<ThemeSwitch />)

    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    system.setDark(false)

    expect(root).toHaveClass('dark')
  })

  it('can be operated with the keyboard alone', async () => {
    const { user } = renderWithProviders(<ThemeSwitch />)

    await user.tab()
    expect(screen.getByRole('radio', { name: 'System' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked()
  })
})
