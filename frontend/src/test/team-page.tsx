import { screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router'

import { TeamPage } from '@/app/routes/team'
import { TeamEditPage } from '@/app/routes/team-edit'
import { Toaster } from '@/components/layout/toaster'

import { serveCounterTeam, serveTeamThreats } from './handlers/counter'
import { renderWithProviders } from './render'
import { TEAM_ID } from './teams'

// The test team's page, and its Edit page.
export const VIEW = `/teams/${TEAM_ID}`
export const EDIT = `/teams/${TEAM_ID}/edit`

/**
 * Answers the sections below a team, for tests that leave them to team-matchups.test.tsx: how to
 * beat someone else's team, and what threatens your own.
 */
export function serveTeamSections() {
  serveCounterTeam()
  serveTeamThreats()
}

/** Renders a team's page and its Edit page at `path`, with the Teams page as a stand-in. */
export function renderTeam(path = VIEW) {
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/teams/:teamId" element={<TeamPage />} />
        <Route path="/teams/:teamId/edit" element={<TeamEditPage />} />
        <Route path="/" element={<p>Home</p>} />
      </Routes>
      <Toaster />
    </>,
    { path },
  )
}

/** The team's slots, in order. Each member's types are a list of their own, so they're left out. */
export function slotRows() {
  const slots = screen.getByRole('list', { name: 'Team, in battle order' })
  return within(slots)
    .getAllByRole('listitem')
    .filter((row) => row.parentElement === slots)
}
