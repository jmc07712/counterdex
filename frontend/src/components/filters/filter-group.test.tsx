import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { FilterGroup } from './filter-group'

describe('FilterGroup', () => {
  it('labels its controls and explains them from its info button', async () => {
    render(
      <FilterGroup id="size" label="Size" infoLabel="About size" info="Small or large.">
        <input aria-labelledby="size" />
      </FilterGroup>,
    )

    expect(screen.getByRole('textbox', { name: 'Size' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'About size' }))

    expect(await screen.findByRole('dialog')).toHaveTextContent('Small or large.')
  })
})
