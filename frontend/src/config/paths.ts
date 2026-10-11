export const paths = {
  home: { path: '/', getHref: () => '/' },
  team: { path: '/teams/:teamId', getHref: (teamId: string) => `/teams/${teamId}` },
  teamEdit: {
    path: '/teams/:teamId/edit',
    getHref: (teamId: string) => `/teams/${teamId}/edit`,
  },
  explore: { path: '/explore', getHref: () => '/explore' },
  pokedex: { path: '/pokedex', getHref: () => '/pokedex' },
  signIn: { path: '/sign-in', getHref: (next?: string) => withNext('/sign-in', next) },
  signUp: { path: '/sign-up', getHref: (next?: string) => withNext('/sign-up', next) },
}

function withNext(path: string, next: string | undefined) {
  return next ? `${path}?${new URLSearchParams({ next })}` : path
}
