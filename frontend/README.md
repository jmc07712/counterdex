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
  features/     admin, auth, pokedex, pokemon-details, sync-status and teams, each with the
                components/, hooks/ and utils/ it needs
  components/   shared UI: ui/ (shadcn), layout/ (the app shell), pokemon/ (cards, badges),
                filters/ (the search, type and view filters the Pokédex and the Teams page
                share), lists/ (Load more, the grids' card entrance, and their results
                region and status) and sync/ (the sync status light)
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
- **Shown at once.** Each change is applied to the cached team, and to the team in its owner's
  cached list of teams, as soon as it's made.
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
  "Changed this week", newest first or, with `?sort=power`, the most powerful first. Each card
  shows the team as party tiles, its types and its power, and says which members a sync changed
  this week and which was removed from PokéAPI and when.
- **A team** (`/teams/:teamId`) is a party screen: the lead large, then the other five in battle
  order, each slot in its main type's color with its stats, and the team's power, the sum of its
  members' base stat totals. Opening a member shows its details. A line above the slots names the
  members a sync changed this week. The lead shows its newest change as the Pokédex's change
  history does, and the other slots sum theirs up on one line. A removed member is muted, with the
  date it was removed in place of its types, which is its newest change.
- **Under someone else's team**, "How to beat this team" shows a counter from `GET
  /api/counter-team`: our picks in battle order, each with a line on why it's there, whether every
  one of theirs has a good answer, and a table of each pick against each of theirs, where choosing
  a matchup explains it in one sentence (`utils/matchup-sentence.ts`). Where the table doesn't fit,
  a list gives our best pick against each of theirs. Build this counter saves the counter shown,
  and opens it in Edit matched up against this team, as Counter beside the team's name does.
- **Under your own team**, "Top threats to this team" shows the Pokémon from
  `GET /api/team-threats` that match up best against it, none from the team's own evolution
  families. A line names its weak spots, the members at least half of the threats beat (three at
  most, then how many more), and the type most of them beat members with, if one type is
  (`utils/weak-spots.ts`). A grid then rates each threat against each member from the member's
  side, as the counter's table rates its picks, so a column of bad matchups is a weak spot, and its
  caption says each cell rates your Pokémon.
  The API scores each threat from its own side, and the grid turns each matchup around
  (`utils/turned-around.ts`). Where the grid doesn't fit, a list
  shows each threat with thumbs of the members it beats. Each threat opens its details. Both
  sections can also pick from alternate forms and legendaries, kept in the URL
  (`?alternate_forms=true&legendaries=true`, apart from the Pokédex filters' `?forms=`) so
  signing in to build a counter comes back to the same one.
- **Its owner** also gets a View / Edit toggle, and a Replace link on each removed member. Edit
  (`/teams/:teamId/edit`) puts the team beside the Pokédex. From `lg` up, the team is a column
  pinned at the left, with its name to rename, the same line above the slots, and its slots, each
  changed member's change on one line, a button to remove each member and a Replace link on each
  removed one; the Pokédex fills the rest, with the Pokédex page's filters, kept in the URL, and
  cards. Each card's button adds its Pokémon, puts it in the place of the member from its
  evolution family, or says why it can't join: it's on the team, or the team is full. A Replace
  link sets `?replace=<id>`: a box above the Pokédex asks for the Pokémon, and each card's button
  then replaces that member. A member's slot can be dragged to another's, with a mouse, a finger
  (at once on its handle, or held still for a moment elsewhere on the slot), or its handle and the
  keyboard (Space, the arrow keys, Space), which puts the team in a new order; the first is the
  lead. With `?against=<team id>`, as building a
  counter opens it, a panel below the slots matches the team up against that one as it's changed:
  whether each of theirs has a good answer, why each of ours is there, and our best answer to
  each of theirs, explained in a sentence when pressed. Tapping a card or a slot opens its
  details. Every change saves at once, so the toggle back to View is the way out.
- **The Pokédex page** (`/pokedex`) has Add to team on each card and in a Pokémon's details: a
  menu of your teams with how many Pokémon each has, where one that can't take the Pokémon says
  why, and New team, which makes a team with it and opens it in Edit. Signed out, the menu links
  to signing in and back. A Pokémon PokéAPI no longer lists has none.

## The admin page

**Admin** (`/admin`), linked from an admin's account menu, is for admins only: anyone else is told
so, and its data is never asked for. Its Sync runs widget lists every sync, a page at a time with
the page in the URL (`?page=2`): a table from `lg`, a list of cards below it.

## Phones

Every page has to work at phone width.
- Below `md`, navigation is a tab bar at the bottom, which hides while scrolling down and comes back
  on any scroll up. A Pokémon's details open as a bottom sheet.
- Toasts take their distance from the bottom from `--toaster-bottom`: above the tab bar below `md`,
  and sonner's default 24px from `md` up. On a page with a floating button (marked
  `data-floating-button`), they sit above that too.
- Below `lg`, the header's sync status is just its light and a short age, or "Failed", though
  the full words are still read out. Edit shows the team first, and its floating Add Pokémon
  button opens the Pokédex in a sheet as tall as the screen, which also opens by itself when a
  member is to be replaced. The box asking for that Pokémon is above the slots and in the sheet,
  and the `?against` panel's picks and answers start folded away.
- In Edit, slots narrower than 34rem, as in its column and on phones, leave out their Pokédex
  numbers and base stat totals, and a Replace link is just its icon. View's party keeps them.

## Tests

- Vitest runs in jsdom, with Testing Library. `renderWithProviders` in `src/test/render.tsx` gives
  each test its own query client and router.
- MSW answers the app's real requests. The helpers in `src/test/handlers.ts` serve each endpoint
  and record what was asked for. A request with no handler is an error.
