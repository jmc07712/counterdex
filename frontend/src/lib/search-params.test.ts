import { describe, expect, it } from 'vitest'

import { parseOption } from './search-params'

const SIZES = ['small', 'large']

describe('parseOption', () => {
  it('gives the option the value names', () => {
    expect(parseOption(SIZES, 'large')).toBe('large')
  })

  it.each([null, '', 'huge', 'Large'])('gives nothing for %j', (value) => {
    expect(parseOption(SIZES, value)).toBeUndefined()
  })
})
