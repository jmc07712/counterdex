import { describe, expect, it } from 'vitest'

import { formatDuration } from './dates'

const START = '2026-10-10T09:00:00Z'

describe('formatDuration', () => {
  it.each([
    ['2026-10-10T09:00:00.400Z', '0 sec'],
    ['2026-10-10T09:00:45Z', '45 sec'],
    ['2026-10-10T09:02:00Z', '2 min'],
    ['2026-10-10T09:02:05Z', '2 min, 5 sec'],
    ['2026-10-10T10:00:05Z', '1 hr, 5 sec'],
    ['2026-10-11T10:02:05Z', '25 hr, 2 min, 5 sec'],
  ])('words the time from the start to %s as %s', (end, words) => {
    expect(formatDuration(START, end)).toBe(words)
  })
})
