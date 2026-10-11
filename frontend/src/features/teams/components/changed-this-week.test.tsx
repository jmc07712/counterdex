import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { catalog, makeTeam } from '@/test/teams'

import { ChangedThisWeekAlert, ChangedThisWeekNote } from './changed-this-week'

const changed = makeTeam({
  pokemon: [catalog.charizard, { ...catalog.pikachu, changed_recently: true }],
}).members
const unchanged = makeTeam({ pokemon: [catalog.charizard, catalog.pikachu] }).members

describe('ChangedThisWeekAlert', () => {
  it('says which members changed this week, as a status, or nothing when none did', () => {
    const { rerender, container } = render(<ChangedThisWeekAlert members={changed} />)

    expect(screen.getByRole('status')).toHaveTextContent('Pikachu changed this week')

    rerender(<ChangedThisWeekAlert members={unchanged} />)

    expect(container).toBeEmptyDOMElement()
  })
})

describe('ChangedThisWeekNote', () => {
  it('says which members changed this week, or nothing when none did', () => {
    const { rerender, container } = render(<ChangedThisWeekNote members={changed} />)

    expect(container).toHaveTextContent('Pikachu changed this week')

    rerender(<ChangedThisWeekNote members={unchanged} />)

    expect(container).toBeEmptyDOMElement()
  })
})
