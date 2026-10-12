export const paths = {
  home: {
    path: '/',
    // The Teams page; `scope: 'mine'` shows someone signed in their own teams.
    getHref: ({ scope }: { scope?: 'mine' } = {}) =>
      scope === undefined ? '/' : `/?${new URLSearchParams({ scope })}`,
  },
  team: { path: '/teams/:teamId', getHref: (teamId: string) => `/teams/${teamId}` },
  teamEdit: {
    path: '/teams/:teamId/edit',
    // `replace` is the id of a member to swap for another Pokémon, and `against` the id of a team
    // to match this one up against.
    getHref: (teamId: string, { replace, against }: { replace?: number; against?: string } = {}) => {
      const query = new URLSearchParams()
      if (replace !== undefined) query.set('replace', `${replace}`)
      if (against !== undefined) query.set('against', against)
      const search = `${query}`
      return search ? `/teams/${teamId}/edit?${search}` : `/teams/${teamId}/edit`
    },
  },
  pokedex: {
    path: '/pokedex',
    // `status: 'changed'` shows the Pokémon syncs changed in the last week.
    getHref: ({ status }: { status?: 'changed' } = {}) =>
      status === undefined ? '/pokedex' : `/pokedex?${new URLSearchParams({ status })}`,
  },
  admin: {
    path: '/admin',
    // `page` is the page of sync runs, counting from 1; page 1 is left out.
    getHref: ({ page = 1 }: { page?: number } = {}) =>
      page === 1 ? '/admin' : `/admin?${new URLSearchParams({ page: `${page}` })}`,
  },
  signIn: { path: '/sign-in', getHref: (next?: string) => withNext('/sign-in', next) },
  signUp: { path: '/sign-up', getHref: (next?: string) => withNext('/sign-up', next) },
}

function withNext(path: string, next: string | undefined) {
  return next ? `${path}?${new URLSearchParams({ next })}` : path
}
