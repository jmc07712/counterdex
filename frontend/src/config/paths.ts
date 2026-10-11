export const paths = {
  home: {
    path: '/',
    // The Teams page; `scope: 'everyone'` shows everyone's teams to someone signed in.
    getHref: ({ scope }: { scope?: 'everyone' } = {}) =>
      scope === undefined ? '/' : `/?${new URLSearchParams({ scope })}`,
  },
  team: { path: '/teams/:teamId', getHref: (teamId: string) => `/teams/${teamId}` },
  teamEdit: {
    path: '/teams/:teamId/edit',
    // `replace` is the id of a member to swap for another Pokémon.
    getHref: (teamId: string, { replace }: { replace?: number } = {}) => {
      const path = `/teams/${teamId}/edit`
      return replace === undefined ? path : `${path}?${new URLSearchParams({ replace: `${replace}` })}`
    },
  },
  pokedex: { path: '/pokedex', getHref: () => '/pokedex' },
  signIn: { path: '/sign-in', getHref: (next?: string) => withNext('/sign-in', next) },
  signUp: { path: '/sign-up', getHref: (next?: string) => withNext('/sign-up', next) },
}

function withNext(path: string, next: string | undefined) {
  return next ? `${path}?${new URLSearchParams({ next })}` : path
}
