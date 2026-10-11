# Counterdex

A Pokémon team builder: browse every Pokémon, build ordered teams of up to six, and see when
PokéAPI changes a Pokémon on a team.

- **App:** https://counterdex.vercel.app
- **API docs:** https://counterdex.vercel.app/api/docs
- **Working on it:** [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md)

## How it fits together

```
Browser ─▶ Vercel (one project, one origin)
             ├─ /api/*  FastAPI ─▶ Postgres (Neon) ◀─ sync job ◀─ PokéAPI
             └─ /*      React SPA (Vite, TanStack Query, shadcn/ui)
```

The backend is split by domain (`pokemon`, `sync`, `accounts`, `teams`) behind thin entrypoints
(`api`, `jobs`), and import-linter keeps FastAPI out of the domains. The frontend flows shared →
features → app.

## Key decisions

**Copy PokéAPI into Postgres instead of calling it live.** PokéAPI's list gives only names, so a
grid with types and stats would need a request per Pokémon, and there's no search or type filter.
Spotting changes also needs a stored copy to compare against. The cost is freshness, so every page
says when the data last synced. [How the sync works](backend/README.md#how-the-sync-works) covers
what it fetches, fair use and its safeguards.

**A change is something users can see.** A Pokémon's tracked fields are its name, types, base
stats, sprite and default-form flag. A sync records a change, with before and after snapshots,
when their hash differs or when PokéAPI stops or starts listing the Pokémon. These changes flag
team members and fill the Teams page's "Changed this week". Species, evolution families, the type
chart and the legendary and mythical flags are reference data, overwritten without history, so
they never flag a team. Team power is always worked out from current stats.

**Flag changed members when a team is read, not through a queue.** Each Pokémon keeps when a sync
last changed it, so every team member comes with `changed_recently`: whether that was in the last
seven days. A team's page and its card say in one line which members changed this week, and the
line goes once the week is up. On the page, each changed member's slot also shows its newest
change from `GET /api/pokemon/{id}/changes`, fetched for those members only, and opening the member
shows its whole change history. Nothing is copied per user, so nothing goes stale.

**Teams are public; only the owner can change one.** Anyone can open a team, or search and filter
everyone's on the Teams page. Every change goes through an owner check that answers 403 to other
users.

**One Pokémon per evolution family.** Charmander, Charizard and Mega Charizard X can't share a
team. Each member stores its species and family; a unique `(team_id, family_id)` and a composite
foreign key to `species(id, evolution_chain_id)` make the database the backstop. The API checks
first, so it can answer 409 `family_on_team`, and the builder marks the Pokémon that can't join.

**Every change saves at once, and changes to one team can't race.** There's no Save button. The UI
shows each change immediately, sends a team's changes one at a time, and puts the team back if the
API refuses one. The owner check locks the team's row, so the server applies them one at a time
too, as tests that race two real connections check. A CHECK on slots 0–5 and a unique slot per
team keep a team to six, and the slot uniqueness is checked at commit, so members can swap. Team
ids are UUIDs the client picks, so `PUT /api/teams/{id}` is a create that's safe to retry.
[Atomicity and races](backend/README.md#atomicity-and-races) has the details.

**Removed Pokémon stay on their teams.** When PokéAPI stops listing a Pokémon, its row is marked
removed, never deleted, so it keeps its slot. The UI shows it muted, with the date it was removed
and its last known stats, and gives the owner a Replace link. The API refuses to add a removed
Pokémon (409 `pokemon_removed`).

**Define the API once, in Python.** The OpenAPI schema generates the frontend's typed client, query
options and enums, and a backend test fails if the committed `frontend/openapi.json` falls behind.
A renamed field then shows up as a TypeScript error wherever it's used.

**Own accounts and cookie sessions.** Passwords are argon2id hashes, and the database stores only a
SHA-256 of each session's token, so a leaked table signs nobody in. In production the cookie is
Secure, HttpOnly, SameSite=Strict and `__Host-` prefixed, and middleware refuses cross-site writes.
Guests can browse everything; building a team needs an account.

**Serve the app and the API from one origin.** Vercel routes `/api/*` to FastAPI and everything
else to the SPA, so there's no CORS and a SameSite=Strict cookie works. Pokédex reads are cached at
the CDN. Everything else defaults to `no-store`, so nothing user-specific is cached by accident.

**Counter teams are worked out on request, from types and base stats.** A team is any one to six of
about 1,350 Pokémon, teams that aren't saved need one too, and every sync can change the inputs,
so nothing is worked out in advance. With no moves to go on, there's no battle to simulate: each
Pokémon is scored against each of theirs on its best type against them, their best type against
it, base stat total and Speed. The team is picked one Pokémon at a time, one per evolution family,
and each matchup comes back with the parts of its score, so a pick can be explained.
[Counter teams](backend/README.md#counter-teams) has the scoring.

## Assumptions

- Moves aren't used, so move lists aren't synced.
- A Pokémon missing from PokéAPI's listing has been removed, unless too many are missing at once.
- A Pokémon joining the Pokédex isn't a change: no team can have it yet.
- "Recently changed" means a sync found the change in the last seven days. When PokéAPI made it
  can't be known.
- An account is a username and a password. With no email, there's no password reset.

## Running it locally

Needs Docker, uv and Node `^22.22.2 || ^24.15.0 || >=26`. Start the database and the API as the
[backend README](backend/README.md#running-it) says, then the app as the
[frontend README](frontend/README.md#running-it) says; each also covers its tests and checks.
