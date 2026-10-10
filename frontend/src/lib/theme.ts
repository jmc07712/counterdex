export type ThemePreference = 'light' | 'system' | 'dark'

/** Keep in sync with the no-flash script in index.html. */
export const THEME_STORAGE_KEY = 'counterdex-theme'

export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

export function getSavedPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage can be unavailable (e.g. blocked cookies); fall back to the system setting.
  }
  return 'system'
}

export function savePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // The theme still applies for this visit.
  }
}

export function applyPreference(preference: ThemePreference) {
  const dark =
    preference === 'dark' || (preference === 'system' && matchMedia(SYSTEM_DARK_QUERY).matches)
  document.documentElement.classList.toggle('dark', dark)
}
