import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDebouncedSearch } from './use-debounced-search'

describe('useDebouncedSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function renderSearch(search: string) {
    return renderHook(({ search }) => useDebouncedSearch(search), { initialProps: { search } })
  }

  it('gives the search once typing pauses, without spaces around it', () => {
    const { result, rerender } = renderSearch('')

    rerender({ search: ' char ' })
    expect(result.current).toBe('')
    act(() => {
      vi.advanceTimersByTime(250)
    })

    expect(result.current).toBe('char')
  })

  it('gives a cleared search at once', () => {
    const { result, rerender } = renderSearch('char')

    rerender({ search: '  ' })

    expect(result.current).toBe('')
  })

  it('waits from the cleared search, not the one before it, for the next', () => {
    const { result, rerender } = renderSearch('char')
    rerender({ search: '' })

    rerender({ search: 'b' })

    expect(result.current).toBe('')
  })
})
