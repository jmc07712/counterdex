import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ChoiceToggle, ChoiceToggles } from './choice-toggles'

function renderSizes(onChange: (value: string) => void) {
  render(
    <>
      <span id="size">Size</span>
      <ChoiceToggles labelledBy="size" value="small" onChange={onChange}>
        <ChoiceToggle value="small">Small</ChoiceToggle>
        <ChoiceToggle value="large">Large</ChoiceToggle>
      </ChoiceToggles>
    </>,
  )
}

describe('ChoiceToggles', () => {
  it('names the choices and shows the one chosen', () => {
    renderSizes(vi.fn())

    expect(screen.getByRole('radiogroup', { name: 'Size' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Small' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Large' })).not.toBeChecked()
  })

  it('says which option is chosen', async () => {
    const onChange = vi.fn()
    renderSizes(onChange)

    await userEvent.click(screen.getByRole('radio', { name: 'Large' }))

    expect(onChange).toHaveBeenCalledWith('large')
  })

  it('keeps the chosen option when it’s chosen again', async () => {
    const onChange = vi.fn()
    renderSizes(onChange)

    await userEvent.click(screen.getByRole('radio', { name: 'Small' }))

    expect(onChange).not.toHaveBeenCalled()
  })
})
