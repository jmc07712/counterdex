import { describe, expect, it } from 'vitest'

import { pageNumbers } from './page-numbers'

describe('pageNumbers', () => {
  it.each([
    [1, 1, [1]],
    [4, 7, [1, 2, 3, 4, 5, 6, 7]],
    [1, 10, [1, 2, 3, 4, 5, 'gap', 10]],
    [4, 10, [1, 2, 3, 4, 5, 'gap', 10]],
    [5, 10, [1, 'gap', 4, 5, 6, 'gap', 10]],
    [6, 10, [1, 'gap', 5, 6, 7, 'gap', 10]],
    [7, 10, [1, 'gap', 6, 7, 8, 9, 10]],
    [10, 10, [1, 'gap', 6, 7, 8, 9, 10]],
  ])('on page %i of %i, numbers %j', (page, total, numbered) => {
    expect(pageNumbers(page, total)).toEqual(numbered)
  })

  it('numbers seven of 20 pages on every page, so the buttons stay put', () => {
    for (let page = 1; page <= 20; page += 1) {
      expect(pageNumbers(page, 20)).toHaveLength(7)
    }
  })
})
