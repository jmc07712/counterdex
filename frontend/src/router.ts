import { createBrowserRouter } from 'react-router'

import { AppShell } from '@/components/app-shell'
import { NotFoundPage } from '@/pages/not-found-page'
import { PokedexPage } from '@/pages/pokedex-page'
import { SignInPage } from '@/pages/sign-in-page'
import { TeamPage } from '@/pages/team-page'
import { TeamsPage } from '@/pages/teams-page'

export const router = createBrowserRouter([
  {
    Component: AppShell,
    children: [
      { index: true, Component: PokedexPage },
      { path: 'teams', Component: TeamsPage },
      { path: 'teams/:teamId', Component: TeamPage },
      { path: 'sign-in', Component: SignInPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
])
