import { screen } from '@testing-library/react'

import { TeamsPage } from '@/app/routes/teams'

import { renderWithProviders } from './render'
import { catalog, makeTeam } from './teams'
import { MISTY } from './users'

// Misty's, then Ash's, each with a Pokémon, newest first.
export const RAIN = makeTeam({
  id: '00000000-0000-4000-8000-00000000000a',
  name: 'Rain',
  owner: { username: MISTY.username },
  created_at: '2026-10-11T12:00:00Z',
  pokemon: [catalog.vaporeon],
})
export const FIRE = makeTeam({
  id: '00000000-0000-4000-8000-00000000000b',
  name: 'Fire',
  created_at: '2026-10-11T11:00:00Z',
  pokemon: [catalog.charizard],
})

/**
 * Renders the Teams page at `path`, and waits for its filters, which show once it knows who's
 * signed in.
 */
export async function renderTeams(path = '/') {
  const rendered = renderWithProviders(<TeamsPage />, { path })
  await screen.findByRole('region', { name: 'Filters' })
  return rendered
}
