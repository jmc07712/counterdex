import { screen, waitFor, within } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'

import {
  type Matchup,
  type Pokemon,
  PokemonType,
  Rating,
  RelativeSpeed,
  type Team,
  type User,
} from '@/api'
import { displayName } from '@/components/pokemon/format'
import {
  type MatchupOf,
  serveCounterTeam,
  serveMatchups,
  serveTeamThreats,
} from '@/test/handlers/counter'
import { servePokemon, servePokemonChanges, servePokemonDetails } from '@/test/handlers/pokemon'
import { serveSession } from '@/test/handlers/session'
import { serveTeams } from '@/test/handlers/teams'
import { makeMatchup } from '@/test/matchups'
import { makeDetails } from '@/test/pokemon'
import { ON_SCREEN } from '@/test/queries'
import { failOnce, holdRequests, server } from '@/test/server'
import { EDIT, renderTeam, VIEW } from '@/test/team-page'
import { catalog, makeTeam, TEAM_ID } from '@/test/teams'
import { ASH, MISTY } from '@/test/users'

const { charizard, pikachu, gengar, lapras, snorlax, dragonite } = catalog
const CATALOG = Object.values(catalog)
const { GOOD, BAD } = Rating

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

// What the threats stand-in lists for Ash's team: Dragonite, Lapras and Snorlax.
const THREATS = [dragonite, lapras, snorlax]

// A threat's Dragon moves beating one of the team.
const DRAGON_WIN: Partial<Matchup> = {
  rating: GOOD,
  score: 1,
  attack: { type: PokemonType.DRAGON, multiplier: 1 },
  stat_total_difference: 66,
}

// How each threat matches up against each of the team's, from the threat's side; even unless
// listed here. Dragonite beats all three, and Lapras beats Charizard.
const THREAT_MATCHUPS: Record<number, Record<number, Partial<Matchup>>> = {
  [dragonite.id]: {
    [charizard.id]: {
      ...DRAGON_WIN,
      opponent_attack: { type: PokemonType.FIRE, multiplier: 0.5 },
      speed: RelativeSpeed.SLOWER,
    },
    [pikachu.id]: DRAGON_WIN,
    [gengar.id]: DRAGON_WIN,
  },
  [lapras.id]: {
    [charizard.id]: {
      rating: GOOD,
      score: 1.25,
      attack: { type: PokemonType.WATER, multiplier: 2 },
      opponent_attack: { type: PokemonType.FIRE, multiplier: 0.5 },
    },
  },
}

const threatMatchupOf: MatchupOf = (pokemon, opponentId) =>
  makeMatchup({ opponent_id: opponentId, ...THREAT_MATCHUPS[pokemon.id]?.[opponentId] })

// Every threat's Rock moves beating Charizard and Pikachu; even with Gengar.
const rockBeatsTwo: MatchupOf = (_, opponentId) =>
  makeMatchup({
    opponent_id: opponentId,
    ...(opponentId !== gengar.id && {
      rating: GOOD,
      score: 1,
      attack: { type: PokemonType.ROCK, multiplier: 2 },
    }),
  })

// What the list of threats is named.
const TOP_THREE = 'The top 3, the biggest first'
// The grid's caption, which names it, also says whose side each cell rates.
const TOP_THREE_GRID =
  'The top 3, the biggest first. Each cell rates your Pokémon (column) against the threat (row) as Good, Even or Bad, with how effective your Pokémon’s best moves are. Choose one to see why.'

// Ash's team, with `viewer` signed in: Misty unless given, or Ash, or nobody. A counter built to
// it opens matched up against it.
function serveTheirs({ viewer = MISTY, team = THEIRS }: { viewer?: User | null; team?: Team } = {}) {
  serveSession({ signedIn: viewer })
  serveMatchups({ catalog: CATALOG, matchup: matchupOf })
  return serveTeams({ teams: [team], catalog: CATALOG, signedIn: viewer })
}

async function findSection() {
  return screen.findByRole('region', { name: 'How to beat this team' })
}

async function findThreats() {
  return screen.findByRole('region', { name: 'Top threats to your team' })
}

function names(pokemon: Pokemon[]) {
  return pokemon.map((each) => displayName(each.name))
}

describe('TeamPage, how to beat someone else’s team', () => {
  it('shows a counter’s picks below the party, in battle order, each with why it’s there', async () => {
    serveTheirs()
    serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    renderTeam()

    const section = await findSection()
    const slots = screen.getByRole('list', { name: 'Team, in battle order' })
    expect(slots.compareDocumentPosition(section)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    const picks = await within(section).findByRole('list', { name: 'Counter picks, in battle order' })
    const tiles = within(picks).getAllByRole('listitem')
    expect(tiles.map((tile) => within(tile).getByRole('heading').textContent)).toEqual(
      names(PICKS),
    )
    expect(tiles[0]).toHaveTextContent('Goes first, vs Charizard')
    expect(tiles[0]).toHaveTextContent('Strong against Charizard')
    expect(tiles[1]).toHaveTextContent('Strong against Pikachu')
    expect(tiles[1]).not.toHaveTextContent('Goes first')
    expect(tiles[2]).toHaveTextContent('Holds its own against Charizard, Pikachu and Gengar')
  })

  it('explains how it chooses its picks and scores a matchup, folded away to begin', async () => {
    serveTheirs()
    serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    const { user } = renderTeam()

    const section = await findSection()
    const choosing = within(section).getByRole('list', { name: 'How the picks are chosen' })
    expect(choosing).not.toBeVisible()

    await user.click(within(section).getByText('How it works'))

    expect(choosing).toBeVisible()
    expect(choosing).toHaveTextContent('Pokémon are added one at a time')
    expect(within(section).getByRole('list', { name: 'How a matchup is scored' })).toHaveTextContent(
      '0.75 or more is Good, −0.75 or less is Bad',
    )
  })

  it('names those of theirs that no pick clearly beats', async () => {
    serveTheirs()
    serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    renderTeam()

    expect(
      await within(await findSection()).findByText('No pick clearly beats Gengar', ON_SCREEN),
    ).toBeInTheDocument()
  })

  it('says when every one of theirs has a good answer', async () => {
    serveTheirs()
    serveCounterTeam({ catalog: PICKS, matchup: alwaysGood })
    renderTeam()

    expect(
      await within(await findSection()).findByText(
        'At least one pick beats each Pokémon on their team',
        ON_SCREEN,
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
    ).toEqual(['Counter pick', ...names([charizard, pikachu, gengar])])
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

    const dialog = await screen.findByRole('dialog', { name: 'Lapras against Charizard' })
    expect(dialog).toHaveTextContent(
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

    const dialog = await screen.findByRole('dialog', { name: 'Snorlax against Pikachu' })
    expect(dialog).toHaveTextContent(
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
      name: 'The best pick against each of this team’s Pokémon',
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
    await waitFor(() => expect(counters).toHaveLength(2))
    await user.click(forms)
    await waitFor(() => expect(counters).toHaveLength(3))

    expect(legendaries).toHaveAttribute('aria-pressed', 'true')
    expect(forms).toHaveAttribute('aria-pressed', 'true')
    const ids = `pokemon_id=${charizard.id}&pokemon_id=${pikachu.id}&pokemon_id=${gengar.id}`
    expect(counters).toEqual([ids, `${ids}&legendaries=true`, `${ids}&forms=true&legendaries=true`])
    expect(router.state.location.search).toBe('?alternate_forms=true&legendaries=true')

    await user.click(forms)

    expect(router.state.location.search).toBe('?legendaries=true')
  })

  it('leaves alone a Pokédex forms filter in the URL', async () => {
    serveTheirs()
    const counters = serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    const { user, router } = renderTeam(`${VIEW}?forms=alternate`)

    const section = await findSection()
    await within(section).findByRole('table')
    const forms = within(section).getByRole('button', { name: 'Alternate forms' })
    expect(forms).toHaveAttribute('aria-pressed', 'false')
    expect(counters[0]).not.toMatch(/forms/)

    await user.click(forms)

    expect(router.state.location.search).toBe('?forms=alternate&alternate_forms=true')
  })

  it('builds the counter shown as a new team, then opens it to edit', async () => {
    const api = serveTheirs()
    const counters = serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    const { user, router } = renderTeam(`${VIEW}?legendaries=true`)

    const section = await findSection()
    await within(section).findByRole('table')
    await user.click(within(section).getByRole('button', { name: 'Build this counter' }))

    await waitFor(() => expect(router.state.location.pathname).toMatch(EDIT_PAGE))
    expect(router.state.location.search).toBe(`?against=${TEAM_ID}`)
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

  it('holds off building while a toggle’s counter loads, so it builds the one shown', async () => {
    const api = serveTheirs()
    serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    const { user, router } = renderTeam()
    const section = await findSection()
    await within(section).findByRole('table')
    const build = within(section).getByRole('button', { name: 'Build this counter' })
    expect(build).toHaveAttribute('aria-disabled', 'false')
    const held = holdRequests('get', '/api/counter-team')

    await user.click(within(section).getByRole('button', { name: 'Legendaries' }))
    await waitFor(() => expect(held.arrived()).toBe(1))

    // Busy, but not disabled, so it keeps focus and takes the click itself.
    expect(build).toHaveAttribute('aria-disabled', 'true')
    expect(build).toHaveAttribute('aria-busy', 'true')
    expect(build).toBeEnabled()
    await user.click(build)
    held.release()
    await waitFor(() => expect(build).toHaveAttribute('aria-disabled', 'false'))
    // Given time, the click while it loaded built nothing.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(api.requests.filter((request) => request.method === 'PUT')).toEqual([])
    expect(router.state.location.pathname).toBe(VIEW)

    await user.click(build)

    await waitFor(() => expect(router.state.location.pathname).toMatch(EDIT_PAGE))
  })

  it('builds the same counter from the Counter button beside the team’s name', async () => {
    const api = serveTheirs()
    const counters = serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    const { user, router } = renderTeam(`${VIEW}?alternate_forms=true`)

    await within(await findSection()).findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Build a counter to Team 1' }))

    await waitFor(() => expect(router.state.location.pathname).toMatch(EDIT_PAGE))
    expect(router.state.location.search).toBe(`?against=${TEAM_ID}`)
    expect(counters).toHaveLength(1)
    expect(counters[0]).toMatch(/&forms=true$/)
    expect(api.teams()[0].members.map((member) => member.pokemon.id)).toEqual(
      PICKS.map((pick) => pick.id),
    )
  })

  it('links someone signed out to signing in first, then back to the same counter', async () => {
    serveTheirs({ viewer: null })
    serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    renderTeam(`${VIEW}?alternate_forms=true`)

    const section = await findSection()

    expect(await within(section).findByRole('link', { name: 'Build this counter' })).toHaveAttribute(
      'href',
      `/sign-in?next=${encodeURIComponent(`${VIEW}?alternate_forms=true`)}`,
    )
  })

  it('shows its skeleton while the counter loads', async () => {
    serveTheirs()
    serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    const held = holdRequests('get', '/api/counter-team')
    renderTeam()

    const section = await findSection()
    expect(
      within(section).getByRole('group', { name: 'Finding a counter to this team' }),
    ).toBeInTheDocument()
    expect(within(section).getByRole('status')).toBeEmptyDOMElement()

    held.release()

    expect(await within(section).findByRole('table')).toBeInTheDocument()
    expect(
      within(section).queryByRole('group', { name: 'Finding a counter to this team' }),
    ).not.toBeInTheDocument()
  })

  it('keeps the counter shown while a toggle’s loads, then reads out what it covers', async () => {
    serveTheirs()
    let matchup = matchupOf
    serveCounterTeam({ catalog: PICKS, matchup: (pokemon, id) => matchup(pokemon, id) })
    const { user } = renderTeam()

    const section = await findSection()
    const status = within(section).getByRole('status')
    await waitFor(() => expect(status).toHaveTextContent('No pick clearly beats Gengar'))
    const table = within(section).getByRole('table')
    // With legendaries, every one of theirs has a good answer.
    matchup = alwaysGood
    const held = holdRequests('get', '/api/counter-team')

    await user.click(within(section).getByRole('button', { name: 'Legendaries' }))

    await waitFor(() => expect(held.arrived()).toBe(1))
    expect(within(section).getByRole('table')).toBe(table)
    expect(table.closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true')
    expect(status).toBeEmptyDOMElement()

    held.release()

    await waitFor(() =>
      expect(status).toHaveTextContent('At least one pick beats each Pokémon on their team'),
    )
    expect(within(section).getByRole('table').closest('[aria-busy]')).toHaveAttribute(
      'aria-busy',
      'false',
    )
    // The same status throughout, so what it says about the new counter is read out.
    expect(within(section).getByRole('status')).toBe(status)
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

  it('dims its needs-sync message while a toggle’s counter loads, then reads it out', async () => {
    serveTheirs()
    serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    failOnce('/api/counter-team', 503)
    const { user } = renderTeam()
    const section = await findSection()
    const message = await within(section).findByText('Counter teams need a Pokédex sync first')
    const status = within(section).getByRole('status')
    expect(status).toBeEmptyDOMElement()
    const held = holdRequests('get', '/api/counter-team')

    await user.click(within(section).getByRole('button', { name: 'Legendaries' }))

    await waitFor(() => expect(held.arrived()).toBe(1))
    expect(message.closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true')

    held.release()

    expect(await within(section).findByRole('table')).toBeInTheDocument()
    await waitFor(() => expect(status).toHaveTextContent('No pick clearly beats Gengar'))
    expect(within(section).getByRole('status')).toBe(status)
  })

  it('asks again when building, once the Pokédex may have synced since it said it hadn’t', async () => {
    const api = serveTheirs()
    const counters = serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    failOnce('/api/counter-team', 503)
    const { user, router } = renderTeam()
    const section = await findSection()
    await within(section).findByText('Counter teams need a Pokédex sync first')

    await user.click(screen.getByRole('button', { name: 'Build a counter to Team 1' }))

    await waitFor(() => expect(router.state.location.pathname).toMatch(EDIT_PAGE))
    expect(counters).toHaveLength(1)
    expect(api.teams()[0].members.map((member) => member.pokemon.id)).toEqual(
      PICKS.map((pick) => pick.id),
    )
  })

  it('says when the counter couldn’t load, and tries again', async () => {
    serveTheirs()
    const counters = serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    failOnce('/api/counter-team', 500)
    const { user } = renderTeam()

    const section = await findSection()
    expect(
      await within(section).findByText('Couldn’t find a counter to this team'),
    ).toBeInTheDocument()
    const status = within(section).getByRole('status')
    expect(status).toBeEmptyDOMElement()

    await user.click(within(section).getByRole('button', { name: 'Try again' }))

    expect(await within(section).findByRole('table')).toBeInTheDocument()
    expect(counters).toHaveLength(1)
    // The same status as while it failed, so what the counter covers is read out.
    expect(within(section).getByRole('status')).toBe(status)
    expect(status).toHaveTextContent('No pick clearly beats Gengar')
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
    serveTeamThreats()
    renderTeam()

    await screen.findByRole('heading', { level: 1, name: 'Team 1' })

    expect(screen.queryByRole('region', { name: 'How to beat this team' })).not.toBeInTheDocument()
    expect(counters).toEqual([])
  })

  it('shows no threats to the team', async () => {
    serveTheirs()
    serveCounterTeam({ catalog: PICKS, matchup: matchupOf })
    const threats = serveTeamThreats({ threats: THREATS })
    renderTeam()

    await within(await findSection()).findByRole('table')

    expect(
      screen.queryByRole('region', { name: 'Top threats to your team' }),
    ).not.toBeInTheDocument()
    expect(threats).toEqual([])
  })
})

describe('TeamPage, threats to your own team', () => {
  it('explains how it chooses the top 12, folded away to begin', async () => {
    serveTheirs({ viewer: ASH })
    serveTeamThreats({ threats: THREATS, matchup: threatMatchupOf })
    const { user } = renderTeam()

    const section = await findThreats()
    const choosing = within(section).getByRole('list', { name: 'How the top 12 are chosen' })
    expect(choosing).not.toBeVisible()

    await user.click(within(section).getByText('How it works'))

    expect(choosing).toHaveTextContent('The 12 with the highest totals are your top threats')
    expect(choosing).toHaveTextContent('A weak spot is one of your Pokémon')
    expect(within(section).getByRole('list', { name: 'How a matchup is scored' })).toBeVisible()
  })

  it('shows its top threats below its party, with where the team is weak to them', async () => {
    serveTheirs({ viewer: ASH })
    serveTeamThreats({ threats: THREATS, matchup: threatMatchupOf })
    renderTeam()

    const section = await findThreats()
    const slots = screen.getByRole('list', { name: 'Team, in battle order' })
    expect(slots.compareDocumentPosition(section)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    // Charizard is beaten by two of the three; Dragon and Water are one threat's type each.
    expect(await within(section).findByText('Weak spots: Charizard.')).toBeInTheDocument()
    expect(within(section).getByRole('table', { name: TOP_THREE_GRID })).toBeInTheDocument()
    expect(within(section).getByRole('list', { name: TOP_THREE })).toBeInTheDocument()
  })

  it('says which type most threats hit with', async () => {
    serveTheirs({ viewer: ASH })
    serveTeamThreats({ threats: THREATS, matchup: rockBeatsTwo })
    renderTeam()

    expect(
      await within(await findThreats()).findByText(
        'Weak spots: Charizard and Pikachu. Most of them hit with Rock.',
      ),
    ).toBeInTheDocument()
  })

  it('says when no Pokémon of the team is beaten by half of its threats', async () => {
    serveTheirs({ viewer: ASH })
    serveTeamThreats({ threats: THREATS })
    renderTeam()

    expect(
      await within(await findThreats()).findByText(
        'No Pokémon of yours is beaten by half of them.',
      ),
    ).toBeInTheDocument()
  })

  it('tables each threat against each member, rated from the member’s side', async () => {
    serveTheirs({ viewer: ASH })
    serveTeamThreats({ threats: THREATS, matchup: threatMatchupOf })
    renderTeam()

    const table = await within(await findThreats()).findByRole('table', { name: TOP_THREE_GRID })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Threat', ...names([charizard, pikachu, gengar])])
    const rowHeaders = within(table).getAllByRole('rowheader')
    expect(rowHeaders.map((header) => within(header).getByRole('button').textContent)).toEqual(
      names(THREATS),
    )
    expect(
      within(within(rowHeaders[0]).getByRole('list', { name: 'Types' }))
        .getAllByRole('listitem')
        .map((type) => type.textContent),
    ).toEqual(['Dragon', 'Flying'])
    const [, dragoniteRow, laprasRow, snorlaxRow] = within(table).getAllByRole('row')
    expect(
      within(dragoniteRow)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual([
      'Charizard against Dragonite: Bad ½×',
      'Pikachu against Dragonite: Bad neutral',
      'Gengar against Dragonite: Bad neutral',
    ])
    expect(
      within(laprasRow)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual([
      'Charizard against Lapras: Bad ½×',
      'Pikachu against Lapras: Even neutral',
      'Gengar against Lapras: Even neutral',
    ])
    expect(within(snorlaxRow).getAllByRole('cell')[0]).toHaveTextContent('Even neutral')
  })

  it('explains a matchup from the member’s side when its cell is chosen', async () => {
    serveTheirs({ viewer: ASH })
    serveTeamThreats({ threats: THREATS, matchup: threatMatchupOf })
    const { user } = renderTeam()

    const table = await within(await findThreats()).findByRole('table', { name: TOP_THREE_GRID })
    await user.click(
      within(table).getByRole('button', { name: 'Charizard against Dragonite: Bad ½×' }),
    )

    const dialog = await screen.findByRole('dialog', { name: 'Charizard against Dragonite' })
    expect(dialog).toHaveTextContent(
      'Charizard’s Fire moves are only ½× against Dragonite, and Dragonite’s Dragon moves are ' +
        'neutral against Charizard. Charizard is faster.',
    )
  })

  it('lists each threat with the members it beats, for narrow screens', async () => {
    serveTheirs({ viewer: ASH })
    serveTeamThreats({ threats: THREATS, matchup: threatMatchupOf })
    renderTeam()

    const list = await within(await findThreats()).findByRole('list', { name: TOP_THREE })
    // Its own items, not those of the lists of types in them.
    const cards = within(list)
      .getAllByRole('listitem')
      .filter((item) => item.parentElement === list)
    expect(cards.map((card) => within(card).getByRole('heading').textContent)).toEqual(
      names(THREATS),
    )
    expect(within(cards[0]).getByText('Beats Charizard, Pikachu and Gengar')).toBeInTheDocument()
    // Its own thumb, and one for each member it beats.
    expect(cards[0].querySelectorAll('img')).toHaveLength(1 + 3)
    expect(within(cards[1]).getByText('Beats Charizard')).toBeInTheDocument()
    expect(cards[1].querySelectorAll('img')).toHaveLength(1 + 1)
    expect(within(cards[2]).getByText('Even with all of yours')).toBeInTheDocument()
    expect(cards[2].querySelectorAll('img')).toHaveLength(1)
  })

  it('opens a threat’s Pokédex details from its card', async () => {
    serveTheirs({ viewer: ASH })
    serveTeamThreats({ threats: THREATS, matchup: threatMatchupOf })
    servePokemonDetails((id) => makeDetails({ pokemon: CATALOG.find((each) => each.id === id) }))
    servePokemonChanges()
    const { user, router } = renderTeam()

    const list = await within(await findThreats()).findByRole('list', { name: TOP_THREE })
    const card = within(list).getByRole('button', { name: 'Dragonite' })
    expect(card).toHaveAccessibleDescription('Beats Charizard, Pikachu and Gengar')
    await user.click(card)

    expect(await screen.findByRole('dialog', { name: 'Dragonite' })).toBeInTheDocument()
    expect(router.state.location.search).toBe(`?pokemon=${dragonite.id}`)
  })

  it('opens a threat’s Pokédex details from its name in the grid', async () => {
    serveTheirs({ viewer: ASH })
    serveTeamThreats({ threats: THREATS, matchup: threatMatchupOf })
    servePokemonDetails((id) => makeDetails({ pokemon: CATALOG.find((each) => each.id === id) }))
    servePokemonChanges()
    const { user, router } = renderTeam()

    const table = await within(await findThreats()).findByRole('table', { name: TOP_THREE_GRID })
    await user.click(within(table).getByRole('button', { name: 'Lapras' }))

    expect(await screen.findByRole('dialog', { name: 'Lapras' })).toBeInTheDocument()
    expect(router.state.location.search).toBe(`?pokemon=${lapras.id}`)
  })

  it('finds threats among alternate forms and legendaries once they’re turned on', async () => {
    serveTheirs({ viewer: ASH })
    const threats = serveTeamThreats({ threats: THREATS, matchup: threatMatchupOf })
    const { user, router } = renderTeam()

    const section = await findThreats()
    await within(section).findByRole('table', { name: TOP_THREE_GRID })
    await user.click(within(section).getByRole('button', { name: 'Alternate forms' }))
    await within(section).findByRole('table', { name: TOP_THREE_GRID })

    const ids = `pokemon_id=${charizard.id}&pokemon_id=${pikachu.id}&pokemon_id=${gengar.id}`
    expect(threats).toEqual([ids, `${ids}&forms=true`])
    expect(router.state.location.search).toBe('?alternate_forms=true')
  })

  it('shows its skeleton while threats load', async () => {
    serveTheirs({ viewer: ASH })
    server.use(http.get('/api/team-threats', () => new Promise<never>(() => {})))
    renderTeam()

    const section = await findThreats()

    expect(
      within(section).getByRole('group', { name: 'Finding threats to your team' }),
    ).toBeInTheDocument()
    expect(within(section).getByRole('status')).toBeEmptyDOMElement()
  })

  it('reads out how many threats there are, and the biggest, once they load', async () => {
    serveTheirs({ viewer: ASH })
    serveTeamThreats({ threats: THREATS, matchup: threatMatchupOf })
    const { user } = renderTeam()

    const section = await findThreats()
    const status = within(section).getByRole('status')
    await waitFor(() =>
      expect(status).toHaveTextContent(
        '3 threats, the biggest Dragonite. Beats Charizard, Pikachu and Gengar.',
      ),
    )
    const threats = within(section).getByRole('table', { name: TOP_THREE_GRID })
    const held = holdRequests('get', '/api/team-threats')

    await user.click(within(section).getByRole('button', { name: 'Legendaries' }))

    await waitFor(() => expect(held.arrived()).toBe(1))
    expect(within(section).getByRole('table', { name: TOP_THREE_GRID })).toBe(threats)
    expect(threats.closest('[aria-busy]')).toHaveAttribute('aria-busy', 'true')
    expect(status).toBeEmptyDOMElement()

    held.release()

    await waitFor(() => expect(status).toHaveTextContent('3 threats, the biggest Dragonite.'))
    expect(threats.closest('[aria-busy]')).toHaveAttribute('aria-busy', 'false')
    expect(within(section).getByRole('status')).toBe(status)
  })

  it('says threats need a Pokédex sync first', async () => {
    serveTheirs({ viewer: ASH })
    serveTeamThreats({ refuse: 503 })
    renderTeam()

    const section = await findThreats()

    expect(
      await within(section).findByText('Threats need a Pokédex sync first'),
    ).toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })

  it('asks again for threats it was told needed a sync, when they’re shown again', async () => {
    serveTheirs({ viewer: ASH })
    const threats = serveTeamThreats({ threats: THREATS, matchup: threatMatchupOf })
    failOnce('/api/team-threats', 503)
    const { user } = renderTeam()
    const section = await findThreats()
    await within(section).findByText('Threats need a Pokédex sync first')
    const forms = within(section).getByRole('button', { name: 'Alternate forms' })

    await user.click(forms)
    await waitFor(() => expect(threats).toHaveLength(1))
    await user.click(forms)

    const ids = `pokemon_id=${charizard.id}&pokemon_id=${pikachu.id}&pokemon_id=${gengar.id}`
    await waitFor(() => expect(threats).toEqual([`${ids}&forms=true`, ids]))
    expect(await within(section).findByRole('table', { name: TOP_THREE_GRID })).toBeInTheDocument()
  })

  it('says when threats couldn’t load, and tries again', async () => {
    serveTheirs({ viewer: ASH })
    const threats = serveTeamThreats({ threats: THREATS, matchup: threatMatchupOf })
    failOnce('/api/team-threats', 500)
    const { user } = renderTeam()

    const section = await findThreats()
    expect(
      await within(section).findByText('Couldn’t find threats to your team'),
    ).toBeInTheDocument()

    await user.click(within(section).getByRole('button', { name: 'Try again' }))

    expect(await within(section).findByRole('table', { name: TOP_THREE_GRID })).toBeInTheDocument()
    expect(threats).toHaveLength(1)
  })

  it('isn’t shown for a team with no Pokémon', async () => {
    serveTheirs({ viewer: ASH, team: makeTeam() })
    const threats = serveTeamThreats({ threats: THREATS })
    renderTeam()

    await screen.findByRole('heading', { level: 1, name: 'Team 1' })

    expect(
      screen.queryByRole('region', { name: 'Top threats to your team' }),
    ).not.toBeInTheDocument()
    expect(threats).toEqual([])
  })

  it('isn’t shown while editing', async () => {
    serveTheirs({ viewer: ASH })
    servePokemon({ items: [], next_cursor: null })
    const threats = serveTeamThreats({ threats: THREATS })
    renderTeam(EDIT)

    await screen.findByRole('textbox', { name: 'Team name' })

    expect(
      screen.queryByRole('region', { name: 'Top threats to your team' }),
    ).not.toBeInTheDocument()
    expect(threats).toEqual([])
  })
})
