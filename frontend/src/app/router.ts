import { createBrowserRouter } from 'react-router'

import { NotFoundPage } from '@/app/routes/not-found'
import { PokedexPage } from '@/app/routes/pokedex'
import { SignInPage } from '@/app/routes/sign-in'
import { TeamPage } from '@/app/routes/team'
import { TeamsPage } from '@/app/routes/teams'
import { AppShell } from '@/components/layout/app-shell'

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
