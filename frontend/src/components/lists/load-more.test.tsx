import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { mockAllIsIntersecting } from 'react-intersection-observer/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { LoadMore } from './load-more'

describe('LoadMore', () => {
  it('loads more when pressed', async () => {
    const onLoadMore = vi.fn()
    render(<LoadMore loading={false} onLoadMore={onLoadMore} />)

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }))

    expect(onLoadMore).toHaveBeenCalledOnce()
  })

  it('loads more as it nears the screen', () => {
    const onLoadMore = vi.fn()
    render(<LoadMore loading={false} onLoadMore={onLoadMore} />)

    mockAllIsIntersecting(true)

    expect(onLoadMore).toHaveBeenCalledOnce()
  })

  it('waits while more are loading', () => {
    const onLoadMore = vi.fn()
    render(<LoadMore loading onLoadMore={onLoadMore} />)

    mockAllIsIntersecting(true)

    expect(onLoadMore).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled()
  })
})
