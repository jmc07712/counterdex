import type { RouteObject } from 'react-router'

import { AppLayout } from '@/app/app-layout'
import { ExplorePage } from '@/app/routes/explore'
import { NotFoundPage } from '@/app/routes/not-found'
import { PokedexPage } from '@/app/routes/pokedex'
import { SignInPage } from '@/app/routes/sign-in'
import { SignUpPage } from '@/app/routes/sign-up'
import { TeamPage } from '@/app/routes/team'
import { TeamEditPage } from '@/app/routes/team-edit'
import { TeamsPage } from '@/app/routes/teams'
import { paths } from '@/config/paths'

/** The app's pages, each inside the app layout. */
export const routes: RouteObject[] = [
  {
    Component: AppLayout,
    children: [
      { index: true, Component: TeamsPage },
      { path: paths.team.path, Component: TeamPage },
      { path: paths.teamEdit.path, Component: TeamEditPage },
      { path: paths.explore.path, Component: ExplorePage },
      { path: paths.pokedex.path, Component: PokedexPage },
      { path: paths.signIn.path, Component: SignInPage },
      { path: paths.signUp.path, Component: SignUpPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
]
