import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { makePokemon } from '@/test/pokemon'
import { renderWithProviders } from '@/test/render'
import { asMember, catalog } from '@/test/teams'

import { TeamCard } from './team-card'

describe('TeamCard', () => {
  it('shows each of the team’s types once, in battle order', () => {
    const members = [catalog.charizard, catalog.vaporeon, catalog.dragonite].map(asMember)

    renderWithProviders(<TeamCard to="/teams/1" name="Sky" members={members} />)

    // Decoration, like the tiles: the link's name reads the types instead.
    const types = screen.getByRole('list', { name: 'Types', hidden: true })
    const badges = within(types).getAllByRole('listitem', { hidden: true })
    expect(badges.map((type) => type.textContent)).toEqual(['Fire', 'Flying', 'Water', 'Dragon'])
  })

  it('names its link with the team’s name, size, types and power', () => {
    const members = [catalog.charizard, catalog.vaporeon, catalog.dragonite].map(asMember)

    renderWithProviders(<TeamCard to="/teams/1" name="Sky" members={members} note="by ash" />)

    expect(screen.getByRole('link')).toHaveAccessibleName(
      'Sky 3 of 6 by ash Types: Fire, Flying, Water, Dragon 1,620',
    )
  })

  it('holds an action beside its link, not in it, and next in focus order', async () => {
    const members = [catalog.charizard, catalog.vaporeon, catalog.dragonite].map(asMember)

    const { user } = renderWithProviders(
      <TeamCard
        to="/teams/1"
        name="Sky"
        members={members}
        note="by ash"
        action={<button type="button">Act</button>}
      />,
    )

    const card = screen.getByRole('article', { name: 'Sky' })
    const link = within(card).getByRole('link')
    const action = within(card).getByRole('button', { name: 'Act' })
    expect(link).not.toContainElement(action)
    expect(link).toHaveAccessibleName('Sky 3 of 6 by ash Types: Fire, Flying, Water, Dragon 1,620')
    await user.tab()
    expect(link).toHaveFocus()
    await user.tab()
    expect(action).toHaveFocus()
  })

  it('fills its power’s bar for a team past the most it measures against', () => {
    // 780 each, past 720.
    const stats = { hp: 106, attack: 190, defense: 100, sp_attack: 154, sp_defense: 100, speed: 130 }
    const members = [1, 2, 3, 4, 5, 6].map((id, position) =>
      asMember(makePokemon({ id, stats }), position),
    )

    renderWithProviders(<TeamCard to="/teams/1" name="Megas" members={members} />)

    const power = screen.getByRole('meter', { name: 'Team power' })
    expect(power).toHaveAttribute('aria-valuenow', '4680')
    expect(power).toHaveAttribute('aria-valuemax', '4680')
  })

  it('shows no types for a team with no Pokémon', () => {
    renderWithProviders(<TeamCard to="/teams/1" name="Empty" members={[]} />)

    expect(screen.queryByRole('list', { name: 'Types', hidden: true })).not.toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAccessibleName('Empty 0 of 6 0')
  })
})
