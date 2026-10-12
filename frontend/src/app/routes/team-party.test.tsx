import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'
import { servePokemonChanges, servePokemonDetails } from '@/test/handlers/pokemon'
import { serveSession } from '@/test/handlers/session'
import { serveTeams } from '@/test/handlers/teams'
import { termsAndDefinitions } from '@/test/queries'
import { renderTeam, serveTeamSections, slotRows } from '@/test/team-page'
import { asMember, catalog, makeTeam } from '@/test/teams'

const { charmander, charizard, pikachu, snorlax, gengar } = catalog
const CATALOG = Object.values(catalog)

const CHANGED_ON = '2026-10-09T09:00:00Z'

beforeEach(serveTeamSections)

describe('TeamPage, as a party', () => {
  it('shows the lead in a slot of its own, then the rest in battle order', async () => {
    serveSession()
    serveTeams({ teams: [makeTeam({ pokemon: [charizard, pikachu, gengar] })], catalog: CATALOG })

    renderTeam()

    await screen.findByRole('heading', { level: 1, name: 'Team 1' })
    expect(screen.getByText('3 of 6')).toBeInTheDocument()
    // Each catalog Pokémon's base stats add up to 540.
    const power = screen.getByRole('meter', { name: 'Team power' })
    expect(power).toHaveAttribute('aria-valuetext', '1,620')
    expect(power).toHaveAttribute('aria-valuenow', '1620')
    expect(power).toHaveAttribute('aria-valuemax', '4320')
    expect(power).toHaveAccessibleDescription('The sum of its Pokémon’s base stats')
    const rows = slotRows()
    expect(rows).toHaveLength(6)
    expect(rows[0]).toHaveTextContent('Lead')
    expect(within(rows[0]).getByRole('heading', { level: 2 })).toHaveTextContent('Charizard')
    expect(rows[0]).toHaveTextContent('No. 0006')
    expect(rows[0]).toHaveStyle({ backgroundColor: TYPE_STYLES.fire.background })
    expect(termsAndDefinitions(rows[0])).toEqual([
      ['HP', '95'],
      ['Attack', '125'],
      ['Defense', '79'],
      ['Sp. Atk', '60'],
      ['Sp. Def', '100'],
      ['Speed', '81'],
      ['Total', '540'],
    ])
    expect(termsAndDefinitions(rows[1])).toContainEqual(['Total', '540'])
    expect(rows.slice(1, 3).map((row) => within(row).getByRole('heading').textContent)).toEqual([
      'Pikachu',
      'Gengar',
    ])
    expect(rows.slice(1).map((row) => row.textContent?.includes('Lead'))).not.toContain(true)
  })

  it('shows its empty slots, and when a member was removed from the Pokédex', async () => {
    serveSession()
    serveTeams({
      teams: [
        makeTeam({
          members: [
            asMember(charmander, 0),
            { ...asMember(pikachu, 1), removed_at: '2026-10-11T09:00:00Z' },
          ],
        }),
      ],
      catalog: CATALOG,
    })

    renderTeam()

    await screen.findByRole('heading', { level: 1, name: 'Team 1' })
    const rows = slotRows()
    expect(rows[1]).toHaveTextContent('Removed from PokéAPI on Oct 11, 2026')
    expect(within(rows[1]).queryByRole('list', { name: 'Types' })).not.toBeInTheDocument()
    expect(rows[1]).not.toHaveStyle({ backgroundColor: TYPE_STYLES.electric.background })
    // Its last known stats stay.
    expect(termsAndDefinitions(rows[1])).toContainEqual(['Total', '540'])
    // Only its owner can replace it.
    expect(within(rows[1]).queryByRole('link', { name: /Replace/ })).not.toBeInTheDocument()
    for (const row of rows.slice(2)) {
      expect(row).toHaveTextContent('Empty slot')
      expect(within(row).queryByRole('link')).not.toBeInTheDocument()
    }
  })

  it('says above its members which of them a sync changed this week', async () => {
    serveSession()
    servePokemonChanges()
    serveTeams({
      teams: [
        makeTeam({
          pokemon: [
            charizard,
            { ...pikachu, changed_recently: true },
            { ...gengar, changed_recently: true },
          ],
        }),
      ],
      catalog: CATALOG,
    })

    renderTeam()

    const line = await screen.findByText('Pikachu and Gengar changed this week')
    const slots = screen.getByRole('list', { name: 'Team, in battle order' })
    expect(line.compareDocumentPosition(slots)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    // A status, so it's read out without taking focus.
    expect(screen.getAllByRole('status').map((status) => status.textContent)).toContain(
      'Pikachu and Gengar changed this week',
    )
  })

  it('asks for the changes of only the members a sync changed, and still in the Pokédex', async () => {
    serveSession()
    serveTeams({
      teams: [
        makeTeam({
          members: [
            asMember(charmander, 0),
            asMember({ ...pikachu, changed_recently: true }, 1),
            { ...asMember({ ...gengar, changed_recently: true }, 2), removed_at: CHANGED_ON },
            asMember({ ...snorlax, changed_recently: true }, 3),
          ],
        }),
      ],
      catalog: CATALOG,
    })
    // Each was renamed.
    const asked = servePokemonChanges((id) =>
      CATALOG.filter((each) => each.id === id).map((after) => ({
        kind: 'updated',
        detected_at: CHANGED_ON,
        before: { ...after, name: 'old-name' },
        after,
      })),
    )

    renderTeam()

    await screen.findByText('Pikachu, Gengar and 1 more changed this week')
    const rows = slotRows()
    await waitFor(() => expect(rows[1]).toHaveTextContent('Name Old Name → Pikachu'))
    expect(rows[3]).toHaveTextContent('Name Old Name → Snorlax')
    expect(asked.toSorted((one, other) => one - other)).toEqual([25, 143])
  })

  it('says nothing changed this week when no sync changed a member', async () => {
    serveSession()
    serveTeams({ teams: [makeTeam({ pokemon: [charizard, pikachu] })], catalog: CATALOG })

    renderTeam()

    await screen.findByRole('heading', { level: 1, name: 'Team 1' })
    expect(screen.queryByText(/changed this week/)).not.toBeInTheDocument()
  })

  it('opens a member’s Pokédex details from its slot, and puts it in the URL', async () => {
    serveSession()
    serveTeams({ teams: [makeTeam({ pokemon: [charmander, charizard] })], catalog: CATALOG })
    servePokemonDetails()
    servePokemonChanges()
    const { user, router } = renderTeam()

    await user.click(await screen.findByRole('button', { name: 'Charizard' }))

    expect(await screen.findByRole('dialog', { name: 'Charizard' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?pokemon=6')
  })
})
