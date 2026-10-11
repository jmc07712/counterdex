import {
  format,
  formatDistanceToNow,
  intlFormatDistance,
  type Locale as DateFnsLocale,
} from 'date-fns'
import { enUS } from 'date-fns/locale'

import { getLocale, type Locale } from '@/paraglide/runtime.js'

// date-fns's words for dates in each of the app's languages.
const DATE_FNS_LOCALES: Record<Locale, DateFnsLocale> = { en: enUS }

function locale() {
  return DATE_FNS_LOCALES[getLocale()]
}

/** "Oct 10, 2026" */
export function formatDate(date: Date | string) {
  return format(date, 'PP', { locale: locale() })
}

/** "Oct 10, 2026, 9:00:00 AM" */
export function formatDateTime(date: Date | string) {
  return format(date, 'PPpp', { locale: locale() })
}

/** "about 3 hours ago" */
export function formatAge(date: Date | string) {
  return formatDistanceToNow(date, { addSuffix: true, locale: locale() })
}

/** "3h ago" */
export function formatShortAge(date: Date | string) {
  return intlFormatDistance(date, new Date(), {
    locale: getLocale(),
    style: 'narrow',
    numeric: 'always',
  })
}

/** "Fire, Flying" */
export function formatList(items: string[]) {
  return new Intl.ListFormat(getLocale(), { type: 'unit', style: 'short' }).format(items)
}
