# Counterdex API

The FastAPI backend. It keeps a copy of PokéAPI in Postgres, serves it, and stores accounts and
teams. Why it's built this way is in the [root README](../README.md); this covers working on it.

## Running it

Needs uv and Docker. Run these from `backend/`, after `cp .env.example .env` and
`docker compose up -d --wait` from the repo root:

```bash
uv sync
uv run --env-file ../.env alembic upgrade head
uv run --env-file ../.env python -m app.jobs.sync_pokemon
uv run --env-file ../.env uvicorn app.api.main:app --port 3000 --reload
```

The interactive docs are at http://localhost:3000/api/docs. The third command fills the database
from PokéAPI; [How the sync works](#how-the-sync-works) explains it.

## Settings

The app reads environment variables only, never `.env` itself. Locally they come from the repo
root's `.env`, passed with `--env-file`; on Vercel they're the project's environment variables.

| Variable | What it does |
| --- | --- |
| `DATABASE_URL` | The Postgres URL. Plain `postgres://` URLs from Neon and Vercel work too. |
| `DATABASE_URL_UNPOOLED` | Neon's direct URL. Migrations use it when it's set, since schema changes shouldn't go through the PgBouncer pooler. |
| `CACHE_RESPONSES` | `false` sends `no-store` on every response, so changes made by hand show at once. Defaults to `true`. |
| `SECURE_COOKIES` | `false` makes the session a plain cookie named `session`, since some browsers refuse `Secure` and `__Host-` cookies over http://localhost. Defaults to `true`. |

## Layout

```
app/
  core/        settings, database plumbing and rules for incoming text
  pokemon/     Pokémon, species and the type chart, and the queries that serve them
  accounts/    users, passwords and sign-in sessions
  sync/        keeping the Pokémon tables in step with PokéAPI, and the change history
  teams/       teams and their members
  counter/     counter teams, threats and one team scored against another, worked out on request
  api/         the FastAPI app: routes, middleware and the docs
  jobs/        command-line jobs, such as sync_pokemon
  migrations/  Alembic
tests/         mirrors app/; shared fixtures are in tests/conftest.py, and builders and the
               fake PokéAPI in tests/support
```

Domains know nothing about how they're called: `core` is at the bottom, `pokemon` and `accounts`
build on it, and `sync`, `teams` and `counter` build on those without importing each other.
Domains never import FastAPI or the entrypoints, and `api` and `jobs` don't import each other.
`uv run lint-imports` checks all of it.

Each file in a domain has one job:
- `models`: tables.
- `schemas`: the shapes the API takes and serves.
- `types`: internal data.
- `enums`, `constants` and `exceptions`.
- `queries`: read-only lookups.
- `service`: the domain's operations.

The sync adds:
- `client`: talks to PokéAPI.
- `pokeapi`: PokéAPI's response shapes.
- `normalize`: turns those into ours.
- `store`: writes them.

## Conventions

- Rules shared by the API and the database, such as base stats of 1–255, are one constant, used by
  both the validator and the table's CHECK.
- Enums are `StrEnum`s, stored as text with a CHECK (`text_enum()`) rather than as Postgres ENUM
  types, which can't drop values.
- Constraints are named by a naming convention, so migrations refer to them predictably.
- When a service needs to know which constraint a write broke, it compares the name with
  `violates_unique` (`app/core/db.py`) against the same constant the table is declared with,
  such as `FAMILY_ON_TEAM` in `app/teams/models.py`. So the two can't drift apart.
- Routes declare their error responses next to the route and turn domain exceptions into
  `HTTPException`s. Responses several routes share are named once, such as `OWNERS_ONLY` and
  `CONFLICTS` for the teams routes and `NOT_SYNCED` for the counter routes.
  Every error's `detail` is a sentence saying what's wrong, and what to do where that helps. A
  team's 409 also gives a `reason` code, such as `family_on_team`, for clients to act on.
- Text the API takes in is refused with a 422 if it contains a NUL character, which Postgres can't
  store. Put `NO_NUL` (`app/core/text.py`) after a string's other constraints.
- Every response is `no-store` (the `NoStoreByDefault` middleware) unless its route calls
  `cache_publicly`.
- No `# noqa` or `# type: ignore`.
- Take only dependency releases that are at least two weeks old.

## Teams

- Every route that changes an existing team depends on `require_team_owner`, which answers 404 or
  403, or locks the team's row. [Atomicity and races](#atomicity-and-races) explains why.
- Each member stores its `species_id` and `family_id` (its species' `evolution_chain_id`). A unique
  `(team_id, family_id)` allows one Pokémon per evolution family, and composite foreign keys tie
  the species to the Pokémon (`species_varieties`) and the family to the species (`species`). The
  service checks the rules first and raises `TeamConflictError`, whose reason becomes the 409's
  `reason`.
- `GET /api/teams` lists everyone's teams that have a Pokémon, newest first, a page at a time. `q`
  matches a team's name, its owner's username or a member's name, ignoring case; `type`, repeatable,
  needs a member of each type; `changed` needs a member a sync changed in the last week; `owner`
  keeps one user's teams, including those with no Pokémon yet unless another filter needs one.
  Filters combine. `sort=power` orders by the sum of the members' base stats instead (`stat_total()`
  in `app/pokemon/queries.py`), worked out on read from current stats, so no index serves it and
  each page reads every matching team.

## Atomicity and races

A change to a team is made in one database transaction, which the route commits only once the
change is complete, so it's saved whole or not at all.

**Two changes to one team.** `require_team_owner` locks the team's row (`lock_owned_team`, a
`SELECT … FOR UPDATE`) before the route reads the team, and the lock is held until the request
commits. A second change to the same team waits for the first, then reads the team the first left,
so changes to one team run one at a time. Changes to different teams don't wait for each other.

**Rules checked after the lock.** Because the service reads the team only once it holds the lock,
its checks see the latest members:
- a full team refuses another Pokémon (409 `team_full`);
- a team that already has the family refuses another (409 `family_on_team`);
- a reorder must list exactly the current members, so one made before someone else's removal is
  refused (409 `order_out_of_date`) instead of applied to a team it never saw.

**The database as the backstop.** The rules hold even for a write that skips the service:
- a unique `(team_id, family_id)` allows one Pokémon per evolution family, and `_guarded` turns a
  violation into the same 409 `family_on_team`;
- a CHECK keeps `position` between 0 and 5, and a unique `(team_id, position)` gives each slot one
  member, so a team can't pass six;
- the slot uniqueness is checked at commit, so a reorder or replace can move members through each
  other's slots. Each change that moves members ends with `_check_slots`, which checks it then and
  defers it again, so a clash is found inside the change rather than at commit.

**Creating a team.** The client picks the team's UUID and sends `PUT /api/teams/{id}`. If the same
request arrives twice, from a retry or a double click, the second gets the team the first made
instead of making another. If another user already has the id, it's a 409 `team_id_taken`; the
insert runs in a savepoint, so that answer doesn't abort the request. The new team's Pokémon are
added in the same transaction, so a refused Pokémon leaves no team behind.

**The sync** runs as one transaction under an advisory lock, so a run is saved whole or not at all
and two never write at once. [How the sync works](#how-the-sync-works) has the details.

**How it's tested.** `tests/teams/test_races.py` holds one change's lock uncommitted, starts a
second change on another connection, waits until Postgres shows that connection waiting for a lock
(`pg_locks`), then commits the first and checks what the second found: a full team, a family
already on it, or an out-of-date order. `test_a_change_waits_for_one_in_progress_then_sees_it`
does the same through the API, and `test_the_database_refuses_a_family_member_the_check_couldnt_see`
adds a Pokémon without the lock to show the constraint refuses it alone.

## Counter teams

Three routes answer from the Pokédex and the type chart alone, and write nothing:
`GET /api/counter-team` picks a team to beat the one given, `GET /api/team-threats` lists the
Pokémon that beat it most, and `GET /api/matchups` scores one team against another, such as a team
being built against the team it's meant to counter. Teams are given as repeated Pokémon ids, so a
team that isn't saved works too.

**A matchup** is one Pokémon against another, scored from the first one's side from types and base
stats, with no moves (`scoring.py`; the weights are in `constants.py`):
- **Offense:** its best type against the opponent scores log2 of the multiplier: 4× is +2, 2× +1,
  1× 0, ½× −1, ¼× −2, and no effect −3.
- **Defense:** the opponent's best type against it is scored the same way and subtracted.
- **Power:** ±0.25 for each 100 of base stat total between them.
- **Speed:** ±0.25 for being faster or slower.

Types move the score by whole points and stats by quarters, so a type's edge usually decides a
matchup, but a big enough gap in stats can outweigh it. A score of 0.75 or more is `good`, −0.75
or less `bad`, and anything between `even`: a one-point type edge stays good unless the stats take
more than a quarter of it back. Each matchup comes with the parts it's scored from (`attack`,
`opponent_attack`, `speed` and `stat_total_difference`), so a client can say why it's good. Scores
are rounded to 9 decimals, so scores equal on paper compare equal and ties are broken by the rules
below, not by float rounding.

**The counter team** (`search.py`) is chosen one Pokémon at a time. Each pick is the one that most
raises the team's score: its best score against each of their Pokémon, added up, less a point for
each of their types that three or more of its Pokémon are weak to, since one of theirs could beat
all of those. Ties go to the higher total score against their team, then the higher base stat total,
then the lower id, so a team always gets the same answer from the same data. Picks come from
different evolution families, so the result can be saved, and only from Pokémon PokéAPI lists;
alternate forms and legendary and mythical Pokémon only when asked for (`forms=true`,
`legendaries=true`). The team comes in battle order: first the Pokémon that scores best against
their lead, then the rest in the order of the opponents they each score best against.

Choosing one at a time isn't guaranteed to find the best possible six: that would mean scoring
every set of six from the whole Pokédex. It's quick, it gives the same answer every time, and each
pick can be explained by its matchups.

**Why these numbers.** The weights are picked by hand, because there's no battle data to fit them
to. Each one is checked against the synced Pokédex. For example, a stat gap only outweighs a whole
type step in 0.6% of pairs, so types decide most matchups. The reason for every number is written
next to it in `app/counter/constants.py`, and the root README sums them up in
[Why it's scored this way](../README.md#why-its-scored-this-way).

**The threats** are the 12 Pokémon with the highest total score against the team, each evolution
family once, by its best. Pokémon from the team's own evolution families are left out, a removed
member's too, so the team's Pokémon and their evolutions never come back as threats to it.
**Matchups** scores each of ours against each of theirs.

**Worked out on request.** A team is any one to six of about 1,350 Pokémon, teams that aren't saved
need answers too, and a sync can change the stats and types they're scored from, so nothing is
worked out in advance. A request reads the type chart and the Pokémon it can choose from, then
scores each of them against at most six in memory. Responses are cached like the Pokédex's
(`COUNTER_TEAM_CACHE_CONTROL`), since the same ids get the same answer until a sync changes the
data. Until a sync has stored the type chart the routes answer 503 and say to run one, as the
counter team does while there are fewer evolution families to choose from than the team has
Pokémon. An unknown id, or one given twice on a team, is a 422.

## The type chart and legendary flags

Two pieces of PokéAPI data exist for the counter team and the threats list, and nothing else
reads them.

- **`type_matchups`** is the type chart: one row for each pair of the 18 types, 324 in all, with
  the share of damage a move of the attacking type does to a Pokémon of the defending type: 0, ½,
  1 or 2. A Pokémon with two types takes the product of both rows, so Rock against Charizard
  (Fire/Flying) is 2 × 2 = 4×. It's how a Pokémon's weaknesses, resistances and immunities are
  worked out. It's stored rather than written into the code because it's PokéAPI's data like the
  rest, refreshed by every sync, and checks allow only known types and those four multipliers.
  Until a sync has stored it, the counter routes answer 503 and say to run one.
- **`species.is_legendary`** and **`species.is_mythical`** mark species such as Mewtwo and Mew.
  The counter search leaves them out unless `legendaries=true`, so it suggests Pokémon a player
  would usually field. PokéAPI doesn't flag Paradox Pokémon or Ultra Beasts, so they count as
  regular Pokémon.

## How the sync works

`python -m app.jobs.sync_pokemon` (`app/jobs/sync_pokemon.py`) runs `run_sync`
(`app/sync/service.py`), then the [team follow-up](#the-team-follow-up), and commits them
together.

### What it fetches

`PokeApiClient` (`app/sync/client.py`) reads:
- the `pokemon` and `pokemon-species` listings, `PAGE_SIZE` (200) entries a page, then every
  Pokémon, every species, and each evolution chain the species belong to, once per chain;
- the 18 types, whose damage relations become the type chart in `type_matchups`.

Each species also brings its legendary and mythical flags. That's about 3,000 requests a run.
Every response is validated with Pydantic (`pokeapi.py`) and turned into our shapes
(`normalize.py`). The client only requests URLs on PokéAPI, and redirects aren't followed. A
listing that fails or can't be trusted, such as one that loops or runs past `MAX_PAGES`, fails the
sync, since whatever is missing from a listing counts as removed.

### Fair use

The limits are in `app/sync/constants.py`:
- Every request sends `USER_AGENT`, which names the app and links to its repository.
- At most `CONCURRENT_REQUESTS` (20) requests are in flight, each with a timeout of
  `REQUEST_TIMEOUT_SECONDS` (15).
- Only rate limiting, server errors (`RETRYABLE_STATUS_CODES`: 429, 500, 502, 503 and 504) and
  network failures are retried, up to `MAX_ATTEMPTS` (3) tries in all, waiting
  `RETRY_DELAY_SECONDS` (0.5) and then twice as long before each further retry. A 429 or 503 that
  asks in `Retry-After` for a number of seconds gets that wait instead, up to
  `MAX_RETRY_AFTER_SECONDS` (30).

PokéAPI answers from Cloudflare's cache, with `cache-control: public, max-age=86400`, so syncing
more than once a day can't see newer data.

### How changes are detected and stored

`store_pokemon` (`app/sync/store.py`) compares each fetched Pokémon with its row. The tracked
fields are the Pokémon's columns: name, types, base stats, sprite and default-form flag, hashed
with SHA-256 into `content_hash`.
- **New:** inserted without a change, since no team can have it yet.
- **Updated:** the hash differs.
- **Removed:** stored and not yet removed, but missing from PokéAPI's listing. The row gets
  `removed_at` and is never deleted, so teams keep it. A Pokémon whose fetch failed is left as it
  was: only the listing decides what's removed.
- **Restored:** marked removed, and listed again.

Each change is a row in `pokemon_changes`, with snapshots of the tracked fields from before and
after (a removal has no after), and sets the Pokémon's `last_changed_at`. That column is what the
`changed` filters and `changed_recently` read. Each run is a row in `sync_runs`, with its counts
and what failed. `GET /api/sync/status` serves when the data last synced and how the latest run
went.

Species, evolution families and the type chart are reference data: overwritten without history.
A family is stored only if all of its species and its chain were fetched, and the type chart only
if all 18 types were; otherwise what was stored before stays.

Safeguards, since a bad sync would flag every team:
- A sync that would remove more than `MAX_REMOVED_SHARE` (5%) of the stored Pokémon, or
  `MIN_REMOVALS_ALLOWED` (10) if that's more, raises `SuspiciousRemovalError`: a broken listing
  is likelier than that many real removals.
- `run_sync` first takes a transaction-level advisory lock on `SYNC_LOCK_KEY`, so only one sync
  writes at a time. A second raises `SyncAlreadyRunningError`.
- The whole run is one transaction, so the data, its changes and the run's record are saved
  together or not at all. On any error the job rolls back, records a failed run with the error,
  and exits 1.
- If a Pokémon, species, chain or type still fails after retrying, everything else is saved, the
  run lists what failed, and the job exits 1. The next run fills the gaps.

### The team follow-up

After `run_sync`, the job calls `follow_species_families` (`app/teams/service.py`) in the same
transaction. When PokéAPI moves a Pokémon to a species in another family, its members'
`species_id` follows through the cascading foreign key to `species_varieties`, and
`follow_species_families` moves their `family_id` to the new species' family. The foreign key to
`species` is checked at commit, so the member can be out of step in between.

A move that would put two Pokémon from one family on a team breaks the unique
`(team_id, family_id)`, so the run fails, is rolled back and is recorded as failed. Otherwise the
sync would have to choose which Pokémon to take off someone's team.

### Running a sync

```bash
uv run --env-file ../.env python -m app.jobs.sync_pokemon
```

It logs a summary and exits 0 only if nothing failed. Nothing schedules it yet (`vercel.json` has
no cron), so production is synced by running it by hand with production's `DATABASE_URL`. Once a
day is the natural cadence, given PokéAPI's 24-hour cache. Tests never reach PokéAPI: they use a
fake, described under [Tests and checks](#tests-and-checks).

### Admins and the run history

`users.is_admin` marks admins, and `GET /api/session` includes it. `GET /api/sync/runs` lists every
sync run, newest first, a page at a time (`page`, `page_size`), with the total so a page can say
"Page 2 of 5". Its `require_admin` dependency answers 401 to visitors and 403 to users who aren't
admins. Admin is granted, or taken away with `--revoke`, from the command line:

```bash
uv run --env-file ../.env python -m app.jobs.make_admin USERNAME
```

## Migrations

```bash
uv run --env-file ../.env alembic revision --autogenerate -m "store something"
uv run --env-file ../.env alembic upgrade head
```

New files are date-prefixed, and ruff lints and formats them as they're written. Tests check that
the migrations match the models, including the CHECK constraints autogenerate can't see, and that
they downgrade cleanly. Nothing runs migrations on deploy: production's are run by hand, over
Neon's direct URL.

Two team constraints are deferred to commit: the unique slot, so members can swap slots, and the
member's foreign key to its species' family, so the sync can move a member to its new family before
committing. `check_a_team_members_family_at_commit` makes the second deferrable with a hand-written
`alter constraint`.

## Tests and checks

```bash
uv run pytest                                      # needs Docker
uv run ruff check . && uv run ruff format --check .
uv run mypy app tests                              # strict
uv run lint-imports
```

- Database tests start a throwaway Postgres 17 container on first use (Testcontainers) and migrate
  it. Each test runs in a transaction that's rolled back. Tests of pure logic don't start it.
- pytest-socket fails any test that connects to anything but localhost and Docker's socket. The
  fake PokéAPI in `tests/support/pokeapi.py` serves recorded responses from
  `tests/support/pokeapi_responses` (Charizard's and Pikachu's families, and all 18 types) through
  a mock transport, and a test can make requests fail or edit the responses.
- Race tests commit on two real connections, and use `pg_locks` to wait until the second is
  blocked before the first commits.
- The suite has about 600 tests and runs in under ten seconds. Each behavior is tested once, at
  the level that shows it best. Rules are tested in the service, and status codes, messages and
  caching through the routes.
- Passwords are hashed with cheap Argon2 settings in tests, except in
  `tests/accounts/test_passwords.py`, which checks the real ones. Real hashing would take a
  quarter of the run.
- Shared fixtures such as `pokedex` (the type chart and a set of real Pokémon with their species and
  families, as a sync stores them) and `sessions` live in `tests/conftest.py`. Builders such as
  `remove_pokemon` and `change_recently` are in `tests/support/pokemon.py`.
- One test checks that every route and every parameter has a description, so the API docs stay
  complete.

## The frontend's client

The frontend's API client is generated from this app's OpenAPI schema. After changing a route or a
schema, run `npm run api:generate` in `frontend/`. `tests/api/test_export_openapi.py` fails until
you do.
