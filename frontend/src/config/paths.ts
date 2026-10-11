export const paths = {
  pokedex: { path: '/', getHref: () => '/' },
  teams: { path: '/teams', getHref: () => '/teams' },
  team: { path: '/teams/:teamId', getHref: (teamId: string) => `/teams/${teamId}` },
  signIn: { path: '/sign-in', getHref: (next?: string) => withNext('/sign-in', next) },
  signUp: { path: '/sign-up', getHref: (next?: string) => withNext('/sign-up', next) },
}

function withNext(path: string, next: string | undefined) {
  return next ? `${path}?${new URLSearchParams({ next })}` : path
}
