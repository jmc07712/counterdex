import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'

import { type Matchup, type Pokemon, PokemonType, Rating, RelativeSpeed, type Team } from '@/api'
import { Toaster } from '@/components/layout/toaster'
import {
  holdCounterTeams,
  type MatchupOf,
  serveCounterTeam,
  serveSession,
  serveTeams,
} from '@/test/handlers'
import { makeMatchup } from '@/test/matchups'
import { renderWithProviders } from '@/test/render'
import { server } from '@/test/server'
import { catalog, makeTeam, TEAM_ID } from '@/test/teams'
import { ASH, MISTY } from '@/test/users'

import { TeamPage } from './team'
import { TeamEditPage } from './team-edit'

const { charizard, pikachu, gengar, lapras, snorlax, dragonite } = catalog
const CATALOG = Object.values(catalog)
const { GOOD, BAD } = Rating

const VIEW = `/teams/${TEAM_ID}`
const EDIT_PAGE = /^\/teams\/([0-9a-f-]{36})\/edit$/

// Ash's, which Misty and someone signed out can counter.
const THEIRS = makeTeam({ pokemon: [charizard, pikachu, gengar] })

// What the counter stand-in picks from: for their team, Lapras, Snorlax and Dragonite.
const PICKS = [lapras, snorlax, dragonite]

// How each pick matches up against each of theirs, by their ids; even unless listed here.
const MATCHUPS: Record<number, Record<number, Partial<Matchup>>> = {
  [lapras.id]: {
    [charizard.id]: {
      rating: GOOD,
      score: 1.25,
      attack: { type: PokemonType.WATER, multiplier: 2 },
      opponent_attack: { type: PokemonType.FIRE, multiplier: 0.5 },
      speed: RelativeSpeed.SLOWER,
    },
    [pikachu.id]: {
      rating: BAD,
      score: -1.25,
      attack: { type: PokemonType.WATER, multiplier: 1 },
      opponent_attack: { type: PokemonType.ELECTRIC, multiplier: 2 },
      speed: RelativeSpeed.SLOWER,
    },
  },
  [snorlax.id]: {
    [pikachu.id]: {
      rating: GOOD,
      score: 1,
      speed: RelativeSpeed.SLOWER,
      stat_total_difference: 220,
    },
    [gengar.id]: {
      rating: BAD,
      score: -1,
      attack: { type: PokemonType.NORMAL, multiplier: 0 },
      opponent_attack: { type: PokemonType.GHOST, multiplier: 0 },
    },
  },
}

const matchupOf: MatchupOf = (pokemon, opponentId) =>
  makeMatchup({ opponent_id: opponentId, ...MATCHUPS[pokemon.id]?.[opponentId] })

// Every pick rated good against every one of theirs.
const alwaysGood: MatchupOf = (_, opponentId) =>
  makeMatchup({ opponent_id: opponentId, rating: GOOD, score: 1 })

function renderTeam(path = VIEW) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/teams/:teamId" element={<TeamPage />} />
        <Route path="/teams/:teamId/edit" element={<TeamEditPage />} />
      </Routes>
      <Toaster />
    </>,
    { path },
  )
}

// Misty, or someone signed out, looking at their team.
function serveTheirs({ viewer = MISTY, team = THEIRS }: { viewer?: typeof MISTY | null; team?: Team } = {}) {
  serveSession({ signedIn: viewer })
  return serveTeams({ teams: [team], catalog: CATALOG, signedIn: viewer })
}

async function findSection() {
  return screen.findByRole('region', { name: 'How to beat this team' })
}

function names(pokemon: Pokemon[]) {
  return pokemon.map((each) => each.name.charAt(0).toUpperCase() + each.name.slice(1))
}

describe('TeamPage, how to beat someone else’s team', () => {
  it('shows a counter’s picks below the party, in battle order, each with why it’s there', async () => {
    serveTheirs()
    serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    renderTeam()

    const section = await findSection()
    const slots = screen.getByRole('list', { name: 'Team, in battle order' })
    expect(slots.compareDocumentPosition(section)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    const picks = await within(section).findByRole('list', { name: 'Our picks, in battle order' })
    const tiles = within(picks).getAllByRole('listitem')
    expect(tiles.map((tile) => within(tile).getByRole('heading').textContent)).toEqual(
      names(PICKS),
    )
    expect(tiles[0]).toHaveTextContent('Leads against Charizard')
    expect(tiles[0]).toHaveTextContent('Strong against Charizard')
    expect(tiles[1]).toHaveTextContent('Strong against Pikachu')
    expect(tiles[1]).not.toHaveTextContent('Leads against')
    expect(tiles[2]).toHaveTextContent('Holds its own against Charizard, Pikachu and Gengar')
  })

  it('names those of theirs that no pick clearly beats', async () => {
    serveTheirs()
    serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    renderTeam()

    expect(
      await within(await findSection()).findByText('Nothing here clearly beats Gengar'),
    ).toBeInTheDocument()
  })

  it('says when every one of theirs has a good answer', async () => {
    serveTheirs()
    serveCounterTeam({ catalog: PICKS, matchup: alwaysGood })
    renderTeam()

    expect(
      await within(await findSection()).findByText(
        'Every Pokémon on their team has a good answer',
      ),
    ).toBeInTheDocument()
  })

  it('tables each pick’s matchup against each of theirs, in words and multipliers', async () => {
    serveTheirs()
    serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    renderTeam()

    const table = await within(await findSection()).findByRole('table')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Our pick', ...names([charizard, pikachu, gengar])])
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual(names(PICKS))
    const [, laprasRow, snorlaxRow] = within(table).getAllByRole('row')
    expect(
      within(laprasRow)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual([
      'Lapras against Charizard: Good 2×',
      'Lapras against Pikachu: Bad neutral',
      'Lapras against Gengar: Even neutral',
    ])
    expect(within(snorlaxRow).getAllByRole('cell')[2]).toHaveTextContent('Bad no effect')
  })

  it('explains a matchup in one sentence when its cell is chosen', async () => {
    serveTheirs()
    serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    const { user } = renderTeam()

    const table = await within(await findSection()).findByRole('table')
    await user.click(within(table).getByRole('button', { name: 'Lapras against Charizard: Good 2×' }))

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Lapras’s Water moves are 2× against Charizard, and Charizard’s Fire moves are only ½× ' +
        'against Lapras. Charizard is faster.',
    )
  })

  it('opens a matchup’s sentence from the keyboard, and closes it on Escape', async () => {
    serveTheirs()
    serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    const { user } = renderTeam()

    const table = await within(await findSection()).findByRole('table')
    const cell = within(table).getByRole('button', { name: 'Snorlax against Pikachu: Good neutral' })
    cell.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Snorlax’s Normal moves are neutral against Pikachu, and Pikachu’s Normal moves are ' +
        'neutral against Snorlax. Pikachu is faster. Snorlax’s base stats total 220 more.',
    )

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(cell).toHaveFocus()
  })

  it('lists our best pick against each of theirs, for narrow screens', async () => {
    serveTheirs()
    serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    renderTeam()

    const section = await findSection()
    const list = await within(section).findByRole('list', {
      name: 'Our best pick against each of theirs',
    })
    const items = within(list).getAllByRole('listitem')
    expect(items.map((item) => within(item).getByRole('heading').textContent)).toEqual([
      'vs Charizard',
      'vs Pikachu',
      'vs Gengar',
    ])
    expect(items[0]).toHaveTextContent(
      'Lapras Good 2×' +
        'Lapras’s Water moves are 2× against Charizard, and Charizard’s Fire moves are only ½× ' +
        'against Lapras. Charizard is faster.',
    )
    expect(items[1]).toHaveTextContent(/^vs PikachuSnorlax Good neutral/)
    // Lapras and Dragonite are even against Gengar; Lapras is first in battle order.
    expect(items[2]).toHaveTextContent(/^vs GengarLapras Even neutral/)
  })

  it('picks from alternate forms and legendaries only once they’re turned on', async () => {
    serveTheirs()
    const counters = serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    const { user, router } = renderTeam()

    const section = await findSection()
    await within(section).findByRole('table')
    const forms = within(section).getByRole('button', { name: 'Alternate forms' })
    const legendaries = within(section).getByRole('button', { name: 'Legendaries' })
    expect(forms).toHaveAttribute('aria-pressed', 'false')
    expect(legendaries).toHaveAttribute('aria-pressed', 'false')

    await user.click(legendaries)
    await within(section).findByRole('table')
    await user.click(forms)
    await within(section).findByRole('table')

    expect(legendaries).toHaveAttribute('aria-pressed', 'true')
    expect(forms).toHaveAttribute('aria-pressed', 'true')
    const ids = `pokemon_id=${charizard.id}&pokemon_id=${pikachu.id}&pokemon_id=${gengar.id}`
    expect(counters).toEqual([ids, `${ids}&legendaries=true`, `${ids}&forms=true&legendaries=true`])
    expect(router.state.location.search).toBe('?forms=true&legendaries=true')

    await user.click(forms)

    expect(router.state.location.search).toBe('?legendaries=true')
  })

  it('builds the counter shown as a new team, then opens it to edit', async () => {
    const api = serveTheirs()
    const counters = serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    const { user, router } = renderTeam(`${VIEW}?legendaries=true`)

    const section = await findSection()
    await within(section).findByRole('table')
    await user.click(within(section).getByRole('button', { name: 'Build this counter' }))

    await waitFor(() => expect(router.state.location.pathname).toMatch(EDIT_PAGE))
    const [, teamId] = EDIT_PAGE.exec(router.state.location.pathname) ?? []
    // The counter shown, so not asked for again.
    expect(counters).toEqual([
      `pokemon_id=${charizard.id}&pokemon_id=${pikachu.id}&pokemon_id=${gengar.id}&legendaries=true`,
    ])
    expect(api.teams().find((team) => team.id === teamId)?.members.map((member) => member.pokemon.id)).toEqual(
      PICKS.map((pick) => pick.id),
    )
    expect(await screen.findByRole('textbox', { name: 'Team name' })).toHaveValue(
      'Counter to Team 1',
    )
  })

  it('builds the same counter from the Counter button beside the team’s name', async () => {
    const api = serveTheirs()
    const counters = serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    const { user, router } = renderTeam(`${VIEW}?forms=true`)

    await within(await findSection()).findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Build a counter to Team 1' }))

    await waitFor(() => expect(router.state.location.pathname).toMatch(EDIT_PAGE))
    expect(counters).toHaveLength(1)
    expect(counters[0]).toMatch(/&forms=true$/)
    expect(api.teams()[0].members.map((member) => member.pokemon.id)).toEqual(
      PICKS.map((pick) => pick.id),
    )
  })

  it('links someone signed out to signing in first, then back to the same counter', async () => {
    serveTheirs({ viewer: null })
    serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    renderTeam(`${VIEW}?forms=true`)

    const section = await findSection()

    expect(await within(section).findByRole('link', { name: 'Build this counter' })).toHaveAttribute(
      'href',
      `/sign-in?next=${encodeURIComponent(`${VIEW}?forms=true`)}`,
    )
  })

  it('shows its skeleton while the counter loads', async () => {
    serveTheirs()
    serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    const held = holdCounterTeams()
    renderTeam()

    const section = await findSection()
    expect(
      within(section).getByRole('status', { name: 'Finding a counter to this team' }),
    ).toBeInTheDocument()

    held.release()

    expect(await within(section).findByRole('table')).toBeInTheDocument()
    expect(within(section).queryByRole('status')).not.toBeInTheDocument()
  })

  it('says a counter needs a Pokédex sync first', async () => {
    serveTheirs()
    serveCounterTeam({ refuse: 503 })
    renderTeam()

    const section = await findSection()

    expect(
      await within(section).findByText('Counter teams need a Pokédex sync first'),
    ).toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(within(section).queryByRole('table')).not.toBeInTheDocument()
  })

  it('says when the counter couldn’t load, and tries again', async () => {
    serveTheirs()
    const counters = serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    // Added last, so it answers the first request; the stand-in answers the next.
    server.use(
      http.get(
        '/api/counter-team',
        () => HttpResponse.json({ detail: 'Refused.' }, { status: 500 }),
        { once: true },
      ),
    )
    const { user } = renderTeam()

    const section = await findSection()
    expect(
      await within(section).findByText('Couldn’t find a counter to this team'),
    ).toBeInTheDocument()

    await user.click(within(section).getByRole('button', { name: 'Try again' }))

    expect(await within(section).findByRole('table')).toBeInTheDocument()
    expect(counters).toHaveLength(1)
  })

  it('isn’t shown for a team with no Pokémon', async () => {
    serveTheirs({ team: makeTeam() })
    const counters = serveCounterTeam({ catalog: PICKS })
    renderTeam()

    await screen.findByRole('heading', { level: 1, name: 'Team 1' })

    expect(screen.queryByRole('region', { name: 'How to beat this team' })).not.toBeInTheDocument()
    expect(counters).toEqual([])
  })

  it('isn’t shown to the team’s owner', async () => {
    serveTheirs({ viewer: ASH })
    const counters = serveCounterTeam({ catalog: PICKS })
    renderTeam()

    await screen.findByRole('heading', { level: 1, name: 'Team 1' })

    expect(screen.queryByRole('region', { name: 'How to beat this team' })).not.toBeInTheDocument()
    expect(counters).toEqual([])
  })
})
