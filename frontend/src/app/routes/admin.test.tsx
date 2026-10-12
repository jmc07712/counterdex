import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { SyncStatus } from '@/api'
import { holdNextCurrentUser, serveSession } from '@/test/handlers/session'
import { serveSyncRuns } from '@/test/handlers/sync'
import { cellsByRow, termsAndDefinitions } from '@/test/queries'
import { renderWithProviders } from '@/test/render'
import { failOnce, holdRequests } from '@/test/server'
import { makeSyncRun, makeSyncRuns } from '@/test/sync-runs'
import { ASH, OAK } from '@/test/users'

import { AdminPage } from './admin'

const ERROR = 'PokéAPI answered 503 Service Unavailable for /api/v2/pokemon?limit=200&offset=400'

function renderAdmin(path = '/admin') {
  return renderWithProviders(<AdminPage />, { path })
}

// The runs as a table, which is what wider screens show. Phones show them as a list.
async function findRunsTable() {
  return screen.findByRole('table', { name: 'Sync runs' })
}

// The names of the page links, Previous and Next included.
function pageLinks() {
  const pages = screen.getByRole('navigation', { name: 'Sync run pages' })
  return within(pages)
    .queryAllByRole('link')
    .map((link) => link.getAttribute('aria-label') ?? link.textContent)
}

describe('AdminPage, access', () => {
  it('shows neither the runs nor who it’s for until it knows who’s signed in', async () => {
    serveSession({ signedIn: OAK })
    // Added last, so it answers the first check.
    const release = holdNextCurrentUser(OAK)
    const requests = serveSyncRuns({ runs: [makeSyncRun()] })

    renderAdmin()

    expect(screen.getByRole('heading', { level: 1, name: 'Admin' })).toBeInTheDocument()
    expect(screen.queryByText('This page is for admins')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sync runs' })).not.toBeInTheDocument()
    expect(requests).toEqual([])
    release()

    // An admin's, in a widget of their own.
    expect(await findRunsTable()).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Sync runs' })).toBeInTheDocument()
    expect(
      screen.getByText('A sync run fetches every Pokémon from PokéAPI and saves what changed.'),
    ).toBeInTheDocument()
  })

  it.each([
    ['signed out', null],
    ['signed in without admin', ASH],
  ])('tells someone %s the page is for admins, without asking for the runs', async (_, user) => {
    serveSession({ signedIn: user })
    const requests = serveSyncRuns({ runs: [makeSyncRun()] })

    renderAdmin()

    expect(await screen.findByText('This page is for admins')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the Teams page' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('heading', { name: 'Sync runs' })).not.toBeInTheDocument()
    expect(requests).toEqual([])
  })

  it('says when it couldn’t check who’s signed in, and checks again', async () => {
    const requests = serveSession({ refuse: { currentUser: 500 } })
    const { user } = renderAdmin()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Couldn’t check whether you’re signed in',
    )
    expect(screen.queryByText('This page is for admins')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(requests.checks).toBe(2))
  })
})

describe('AdminPage, sync runs', () => {
  beforeEach(() => {
    serveSession({ signedIn: OAK })
  })

  it('lists each run with its status, start, duration, counts and error', async () => {
    serveSyncRuns({
      runs: [
        makeSyncRun({ id: 2, status: SyncStatus.FAILED, error: ERROR, inserted: 0, updated: 0 }),
        makeSyncRun({ id: 1, failed_count: 5 }),
      ],
    })

    renderAdmin()

    const table = await findRunsTable()
    expect(cellsByRow(table)).toEqual([
      [
        'Status',
        'Started',
        'Duration',
        'New',
        'Updated',
        'Removed',
        'Restored',
        'Couldn’t sync',
        'Error',
      ],
      ['Failed', 'Oct 10, 2026, 9:00:00 AM', '2 min, 5 sec', '0', '0', '2', '1', '0', ERROR],
      ['Succeeded', 'Oct 10, 2026, 9:00:00 AM', '2 min, 5 sec', '4', '3', '2', '1', '5', ''],
    ])
    // When each started, for machines too.
    expect(within(table).getAllByRole('time')[0]).toHaveAttribute('datetime', '2026-10-10T09:00:00Z')
  })

  it('lists the runs on phones too, each with its details', async () => {
    serveSyncRuns({
      runs: [
        makeSyncRun({ id: 2, status: SyncStatus.FAILED, error: ERROR }),
        makeSyncRun({ id: 1, failed_count: 5 }),
      ],
    })

    renderAdmin()

    const list = await screen.findByRole('list', { name: 'Sync runs' })
    const [failed, succeeded] = within(list).getAllByRole('listitem')
    // Each starts with its status, then when it started.
    expect(failed).toHaveTextContent(/^Failed\s*Oct 10, 2026, 9:00:00 AM/)
    expect(within(failed).getByRole('button', { name: ERROR })).toBeInTheDocument()
    expect(succeeded).toHaveTextContent(/^Succeeded\s*Oct 10, 2026, 9:00:00 AM/)
    expect(within(succeeded).queryByRole('button')).not.toBeInTheDocument()
    expect(termsAndDefinitions(succeeded)).toEqual([
      ['Duration', '2 min, 5 sec'],
      ['New', '4'],
      ['Updated', '3'],
      ['Removed', '2'],
      ['Restored', '1'],
      ['Couldn’t sync', '5'],
    ])
  })

  it('shows a run’s whole error from its cut-short one', async () => {
    serveSyncRuns({ runs: [makeSyncRun({ status: SyncStatus.FAILED, error: ERROR })] })
    const { user } = renderAdmin()

    await user.click(within(await findRunsTable()).getByRole('button', { name: ERROR }))

    expect(await screen.findByRole('dialog')).toHaveTextContent(ERROR)
  })

  it('leaves out the pages when there’s only one', async () => {
    serveSyncRuns({ runs: makeSyncRuns(3) })

    renderAdmin()

    await findRunsTable()
    expect(screen.queryByRole('navigation', { name: 'Sync run pages' })).not.toBeInTheDocument()
  })

  it('starts on the page in the URL, and asks the API for it', async () => {
    const requests = serveSyncRuns({ runs: makeSyncRuns(5), pageSize: 1 })

    renderAdmin('/admin?page=2')

    const table = await findRunsTable()
    // Newest first: run 5 is on page 1, so page 2 has run 4, from Sep 4.
    expect(within(table).getByRole('time')).toHaveTextContent('Sep 4, 2026')
    expect(requests).toEqual(['page=2'])
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page')
  })

  it('goes on to the next page and back, keeping the page in the URL but for page 1', async () => {
    const requests = serveSyncRuns({ runs: makeSyncRuns(3), pageSize: 1 })
    const { user, router } = renderAdmin()
    await findRunsTable()

    await user.click(screen.getByRole('link', { name: 'Next' }))

    await waitFor(() => expect(requests).toEqual(['page=1', 'page=2']))
    expect(router.state.location.search).toBe('?page=2')
    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Previous' }))

    expect(await screen.findByText('Page 1 of 3')).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
  })

  it('goes straight to a page by its number', async () => {
    const requests = serveSyncRuns({ runs: makeSyncRuns(3), pageSize: 1 })
    const { user, router } = renderAdmin()
    await findRunsTable()

    await user.click(screen.getByRole('link', { name: 'Page 3' }))

    await waitFor(() => expect(requests.at(-1)).toBe('page=3'))
    expect(router.state.location.search).toBe('?page=3')
  })

  it.each([
    ['first', '/admin', 'Previous', 'Next'],
    ['last', '/admin?page=3', 'Next', 'Previous'],
  ])('can’t go past the %s page', async (_, path, disabled, enabled) => {
    const requests = serveSyncRuns({ runs: makeSyncRuns(3), pageSize: 1 })
    const { user, router } = renderAdmin(path)
    await findRunsTable()

    expect(screen.getByRole('link', { name: disabled })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('link', { name: enabled })).not.toHaveAttribute('aria-disabled')
    await user.click(screen.getByRole('link', { name: disabled }))

    expect(router.state.location.search).toBe(path.replace('/admin', ''))
    expect(requests).toHaveLength(1)
  })

  it('keeps focus on Next once it reaches the last page', async () => {
    serveSyncRuns({ runs: makeSyncRuns(2), pageSize: 1 })
    const { user } = renderAdmin()
    await findRunsTable()

    screen.getByRole('link', { name: 'Next' }).focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
    const next = screen.getByRole('link', { name: 'Next' })
    expect(next).toHaveAttribute('aria-disabled', 'true')
    expect(next).toHaveFocus()
  })

  it('numbers the pages around the one shown, skipping the rest', async () => {
    serveSyncRuns({ runs: makeSyncRuns(10), pageSize: 1 })

    renderAdmin('/admin?page=5')

    await findRunsTable()
    expect(pageLinks()).toEqual([
      'Previous',
      'Page 1',
      'Page 4',
      'Page 5',
      'Page 6',
      'Page 10',
      'Next',
    ])
  })

  // 2147483648 is one past the highest page the API takes.
  it.each(['abc', '0', '-2', '1.5', '2147483648'])(
    'starts on page 1 for ?page=%s',
    async (page) => {
      const requests = serveSyncRuns({ runs: makeSyncRuns(2), pageSize: 1 })

      renderAdmin(`/admin?page=${page}`)

      await findRunsTable()
      expect(requests).toEqual(['page=1'])
    },
  )

  it('fades the runs on screen while the next page loads', async () => {
    serveSyncRuns({ runs: makeSyncRuns(2), pageSize: 1 })
    // Page 2 waits for `release`, then goes on to the stand-in.
    const page2 = holdRequests('get', '/api/sync/runs', (request) =>
      new URL(request.url).searchParams.get('page') === '2',
    )
    const { user } = renderAdmin()
    const table = await findRunsTable()

    await user.click(screen.getByRole('link', { name: 'Next' }))

    expect(table).toHaveAttribute('aria-busy', 'true')
    expect(within(table).getByRole('time')).toHaveTextContent('Sep 2, 2026')
    page2.release()
    await waitFor(() => expect(table).toHaveAttribute('aria-busy', 'false'))
    expect(within(table).getByRole('time')).toHaveTextContent('Sep 1, 2026')
  })

  it('offers the last page from a page past it', async () => {
    serveSyncRuns({ runs: makeSyncRuns(3), pageSize: 1 })
    const { user, router } = renderAdmin('/admin?page=9')

    expect(await screen.findByText('No runs on page 9')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Go to the last page' }))

    expect(await findRunsTable()).toBeInTheDocument()
    expect(router.state.location.search).toBe('?page=3')
  })

  it('says when no sync has run yet', async () => {
    serveSyncRuns()

    renderAdmin()

    expect(await screen.findByText('No sync has run yet')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Sync run pages' })).not.toBeInTheDocument()
  })

  it('says when the runs couldn’t load, and tries again', async () => {
    serveSyncRuns({ runs: [makeSyncRun()] })
    failOnce('/api/sync/runs', 500)
    const { user } = renderAdmin()

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t load the sync runs')
    await user.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await findRunsTable()).toBeInTheDocument()
  })
})
