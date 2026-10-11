# Counterdex web

The React app: the Pokédex, teams and accounts. Why it's built this way is in the
[root README](../README.md); this covers working on it.

## Running it

Needs Node `^22.22.2 || ^24.15.0 || >=26`, the versions the installed jsdom and Vitest support (not
25), and the API running on port 3000 (see [backend/README.md](../backend/README.md)). Vite sends
`/api` requests there.

```bash
npm ci
npm run dev        # http://localhost:5173
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Starts Vite, recompiling messages as they change. |
| `npm run build` | Compiles messages, type-checks, and builds to `dist/`. |
| `npm test` | Runs the tests once (`npm run test:watch` keeps watching). |
| `npm run lint` | Runs oxlint. |
| `npm run api:generate` | Exports the backend's OpenAPI schema to `openapi.json` and regenerates `src/api`. Needs uv. |
| `npm run messages` | Compiles `messages/en.json` into `src/paraglide`. |

## Layout

```
src/
  app/          the route table, the layout around every page, and the pages in routes/, which
                compose features
  features/     auth, pokedex, pokemon-details, sync-status and teams, each with the
                components/, hooks/ and utils/ it needs
  components/   shared UI: ui/ (shadcn), layout/ (the app shell), pokemon/ (cards, badges),
                filters/ (the search, type and view filters the Pokédex and the Teams page
                share) and lists/ (Load more, the grids' card entrance, and their results
                region and status)
  hooks/        shared hooks, such as a debounced search
  lib/          app-wide helpers: who's signed in, the query client, the theme, dates
  config/       page paths
  api/          the generated API client
  paraglide/    the generated messages (not committed)
  test/         the MSW server and handlers, render helpers and test data
  main.tsx      makes the router from app/'s route table and renders the app
messages/en.json  the text the app shows
```

Code flows shared → features → app. Features never import each other; `app/` composes them, so a
page that needs two features, such as a team with its Pokémon's details, renders both.

## Conventions

- **Don't edit generated code.** That's `src/api` (from `npm run api:generate`), `src/paraglide`
  (from `npm run messages`) and `src/components/ui` (from `npx shadcn add <component>`).
- **Use the API's own types.** The generated client has every request and response type, the API's
  enums as runtime values (such as every `PokemonType` and `TeamConflictReason`), a function for
  every route and TanStack Query options for each. An API change then shows up as a type error.
- **Put text in `messages/en.json`.** Paraglide compiles it into typed functions. Values from the
  API, such as types and change kinds, are worded by select messages, and tests check that every
  value has wording.
- **Keep filters and the open Pokémon in the URL**, so a view can be shared or reloaded: the
  Pokédex's and the Teams page's filters (`?q=char&type=fire`, `?scope=mine`), and the
  Pokémon whose details are open (`?pokemon=6`). Opening a Pokémon adds a history entry, so Back
  closes it.
- **Change a team through its hooks.** Each change (`useAddTeamMember`, `useRemoveTeamMember`,
  `useReplaceTeamMember`, `useReorderTeam`, `useRenameTeam`) is built on `useTeamChange`, which
  keeps them in order: see [Changes and races](#changes-and-races).
- **Build links from `config/paths.ts`**, where every page's path is defined.
- **Use the color tokens** in `src/index.css`, which have light and dark values. Saturated color is
  for Pokémon types and the status lights.
- **Text on a type's color uses the type's own text color** from `TYPE_STYLES`, at full strength;
  a test checks every pair reaches 4.5:1 (WCAG AA).
- **Export only components from component files.** Hooks and helpers go in `hooks/`, `utils/` or
  `lib/`. oxlint warns about the rest.
- **Style:** there's no formatter. Use single quotes, no semicolons, and lines up to about 100
  characters.
- **Dependencies:** take only releases that are at least two weeks old, with
  `npm install --before=<date>`.

## Changes and races

A team saves each change as it's made, so several can be on their way at once. `useTeamChange`
(`features/teams/hooks/use-team-change.ts`) keeps them straight:
- **One at a time, in order.** Changes to one team share a TanStack Query mutation scope
  (`teamChangeScope`), so each is sent only once the one before has answered. A response can't
  overtake an earlier one, and the API, which locks the team for each change, sees them in the
  order they were made.
- **Shown at once.** Each change is applied to the cached team as soon as it's made.
- **Undone only when nothing depends on it.** If the API refuses a change, the team is put back
  only if no later change is waiting, and a toast says why. Otherwise the fetch after the last
  change shows the team as it really is.
- **Fetched again once, at the end.** The team and the team lists are fetched again only after the
  last waiting change has settled, so a fetch can't overwrite changes still on their way.
- **One click, one team.** New team ignores clicks while it's creating, and the team's id is a
  UUID picked in the browser, so even a repeated request makes one team.

The API's side is in [Atomicity and races](../backend/README.md#atomicity-and-races).

## The team views

- **Teams** (`/`) lists everyone's teams, with each card saying whose it is, or, for someone
  signed in, their own, empty ones too (`?scope=mine`), searchable and filterable by type and by
  "Changed this week". Each card shows the team as party tiles, its types and its power, and says
  which members a sync changed this week and which was removed from PokéAPI and when.
- **A team** (`/teams/:teamId`) is a party screen: the lead large, then the other five in battle
  order, each slot in its main type's color with its stats, and the team's power, the sum of its
  members' base stat totals. Opening a member shows its details. A line above the slots names the
  members a sync changed this week. The lead shows its newest change as the Pokédex's change
  history does, and the other slots sum theirs up on one line. A removed member is muted, with the
  date it was removed in place of its types, which is its newest change.
- **Its owner** also gets a View / Edit toggle, and a Replace link on each removed member. Edit
  (`/teams/:teamId/edit`) is the builder, with the same line above the slots and each changed
  member's change on one line: rename the team, remove members, and add Pokémon from a browser
  that marks the ones that can't join. Every change saves at once, so the toggle back to View is
  the way out.

## Phones

Every page has to work at phone width.
- Below `md`, navigation is a tab bar at the bottom, which hides while scrolling down and comes back
  on any scroll up. A Pokémon's details open as a bottom sheet.
- Toasts take their distance from the bottom from `--toaster-bottom`: above the tab bar below `md`,
  and sonner's default 24px from `md` up.
- Below `lg`, the header's sync status is just its light and a short age, or "Failed", though
  the full words are still read out, and the builder's Pokémon browser opens in a bottom sheet.

## Tests

- Vitest runs in jsdom, with Testing Library. `renderWithProviders` in `src/test/render.tsx` gives
  each test its own query client and router.
- MSW answers the app's real requests. The helpers in `src/test/handlers.ts` serve each endpoint
  and record what was asked for. A request with no handler is an error.
