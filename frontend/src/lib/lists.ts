import { getLocale } from '@/paraglide/runtime.js'

/** "Fire, Flying" */
export function formatList(items: string[]) {
  return new Intl.ListFormat(getLocale(), { type: 'unit', style: 'short' }).format(items)
}
