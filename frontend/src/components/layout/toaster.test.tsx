import { act, render, screen, within } from '@testing-library/react'
import { toast } from 'sonner'
import { describe, expect, it } from 'vitest'

import { Toaster } from './toaster'

describe('Toaster', () => {
  it('shows toasts at the bottom right, raised by --toaster-bottom in both layouts', async () => {
    render(<Toaster />)

    act(() => {
      toast('Saved')
    })

    const toasts = within(await screen.findByRole('region', { name: /Notifications/ })).getByRole(
      'list',
    )
    expect(toasts).toHaveAttribute('data-y-position', 'bottom')
    expect(toasts).toHaveAttribute('data-x-position', 'right')
    // Sonner's phone layout uses the mobile offset, and its wider layout the other.
    expect(toasts.style.getPropertyValue('--offset-bottom')).toBe('var(--toaster-bottom)')
    expect(toasts.style.getPropertyValue('--mobile-offset-bottom')).toBe('var(--toaster-bottom)')
  })
})
