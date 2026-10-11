import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DealtInItem, DealtInList } from './dealt-in-item'

function List({ names }: { names: string[] }) {
  return (
    <DealtInList>
      {names.map((name, index) => (
        <DealtInItem key={name} index={index}>
          {name}
        </DealtInItem>
      ))}
    </DealtInList>
  )
}

function delays() {
  return screen.getAllByRole('listitem').map((item) => item.style.animationDelay)
}

describe('DealtInList', () => {
  it('deals in the items it first shows one after another', () => {
    render(<List names={['Bulbasaur', 'Ivysaur', 'Venusaur']} />)

    expect(delays()).toEqual(['0ms', '20ms', '40ms'])
  })

  it('shows items it gets later at once, and keeps the first items’ delays', () => {
    const { rerender } = render(<List names={['Bulbasaur', 'Ivysaur']} />)

    rerender(<List names={['Bulbasaur', 'Ivysaur', 'Venusaur', 'Charmander']} />)

    expect(delays()).toEqual(['0ms', '20ms', '0ms', '0ms'])
  })
})
