import { describe, expect, it } from 'vitest'

import { counterTeamName, MAX_TEAM_NAME_LENGTH } from './team-name'

describe('counterTeamName', () => {
  it('names a counter after the team', () => {
    expect(counterTeamName('Rain')).toBe('Counter to Rain')
  })

  it('keeps a team’s name that just fits', () => {
    const name = counterTeamName('a'.repeat(29))

    expect(name).toBe(`Counter to ${'a'.repeat(29)}`)
    expect(name).toHaveLength(MAX_TEAM_NAME_LENGTH)
  })

  it('shortens a longer team’s name to fit, keeping “Counter to”', () => {
    const name = counterTeamName('The Extremely Long Team Name Of Doom!!')

    expect(name).toBe('Counter to The Extremely Long Team Name…')
    expect(name).toHaveLength(MAX_TEAM_NAME_LENGTH)
  })

  it('leaves no space before the ellipsis', () => {
    // Cut after 28 characters, the 28th a space.
    expect(counterTeamName(`${'a'.repeat(27)} bbbbbbbbbb`)).toBe(`Counter to ${'a'.repeat(27)}…`)
  })

  it('counts and cuts characters as the API does, never half of one', () => {
    // Each fire is one character to the API, but two UTF-16 code units.
    const name = counterTeamName('🔥'.repeat(40))

    expect(name).toBe(`Counter to ${'🔥'.repeat(28)}…`)
    expect(Array.from(name)).toHaveLength(MAX_TEAM_NAME_LENGTH)
  })
})
