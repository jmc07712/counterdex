import { Plus, Search } from 'lucide-react'
import { useId, useState } from 'react'
import { useInView } from 'react-intersection-observer'

import type { Pokemon, PokemonType, TeamMember } from '@/api'
import { dexNumber, displayName } from '@/components/pokemon/format'
import { MAX_TYPES, TYPE_STYLES } from '@/components/pokemon/pokemon-types'
import { TypeBadges } from '@/components/pokemon/type-badges'
import { TypeToggles } from '@/components/pokemon/type-toggles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebouncedSearch } from '@/hooks/use-debounced-search'
import { m } from '@/paraglide/messages.js'

import { usePokemonBrowser } from '../hooks/use-pokemon-browser'
import { type CantAdd, cantAdd } from '../utils/can-add'

// Starts loading the next page this far before the end of the list scrolls into view.
const PRELOAD_MARGIN = '400px'

type PokemonBrowserProps = {
  // The team's members, to say which Pokémon can't join them.
  members: TeamMember[]
  onAdd: (pokemon: Pokemon) => void
}

/** Search and filter every Pokémon, and add them to a team one by one. */
export function PokemonBrowser({ members, onAdd }: PokemonBrowserProps) {
  const [search, setSearch] = useState('')
  const [types, setTypes] = useState<PokemonType[]>([])
  const debouncedSearch = useDebouncedSearch(search)
  const typesId = useId()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label={m.team_browser_search()}
          placeholder={m.team_browser_search()}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-8"
        />
      </div>
      <div className="flex items-center gap-2">
        <span id={typesId} className="shrink-0 text-xs font-medium text-muted-foreground">
          {m.pokemon_types()}
        </span>
        {/* One row that scrolls sideways, so the list keeps the height. */}
        <div className="-mr-4 min-w-0 flex-1 overflow-x-auto pr-4 [scrollbar-width:none]">
          <TypeToggles
            labelledBy={typesId}
            value={types}
            // A Pokémon has at most two types: turning on a third turns off the oldest.
            onChange={(chosen) => setTypes(chosen.slice(-MAX_TYPES))}
            className="w-max"
          />
        </div>
      </div>
      <PokemonResults search={debouncedSearch} types={types} members={members} onAdd={onAdd} />
    </div>
  )
}

type PokemonResultsProps = PokemonBrowserProps & { search: string; types: PokemonType[] }

function PokemonResults({ search, types, members, onAdd }: PokemonResultsProps) {
  const query = usePokemonBrowser({ search, types })
  // The list scrolls on its own, so the end of the list is watched within it, not the page.
  const [list, setList] = useState<HTMLElement | null>(null)
  const { ref: endOfList } = useInView({
    root: list,
    rootMargin: PRELOAD_MARGIN,
    onChange: (inView) => {
      if (inView && query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
    },
  })

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((each) => (
          <Skeleton key={each} className="h-12 rounded-lg" />
        ))}
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-start gap-2 text-sm">
        <p className="font-medium">{m.team_browser_load_failed()}</p>
        <p className="text-muted-foreground">{m.common_check_connection()}</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
          {m.common_try_again()}
        </Button>
      </div>
    )
  }

  const pokemon = query.data.pages.flatMap((page) => page.items)

  if (pokemon.length === 0) {
    return <p className="text-sm text-muted-foreground">{m.team_browser_empty()}</p>
  }

  return (
    <div ref={setList} className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2">
      <ul
        aria-label={m.team_browser_results()}
        aria-busy={query.isPlaceholderData}
        className="flex flex-col transition-opacity duration-200 aria-busy:opacity-60"
      >
        {pokemon.map((each) => (
          <PokemonChoice
            key={each.id}
            pokemon={each}
            reason={cantAdd(members, each)}
            onAdd={() => onAdd(each)}
          />
        ))}
      </ul>
      {query.hasNextPage && (
        <div ref={endOfList} className="flex justify-center py-3">
          <Button
            variant="outline"
            size="sm"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? m.common_loading_more() : m.common_load_more()}
          </Button>
        </div>
      )}
    </div>
  )
}

type PokemonChoiceProps = {
  pokemon: Pokemon
  // Why it can't join the team, or null if it can.
  reason: CantAdd | null
  onAdd: () => void
}

function PokemonChoice({ pokemon, reason, onAdd }: PokemonChoiceProps) {
  const name = displayName(pokemon.name)
  return (
    <li
      style={{ '--type': TYPE_STYLES[pokemon.types[0]].background }}
      className="flex items-center gap-3 border-b py-2 last:border-b-0"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--type)_28%,var(--color-card))]">
        {pokemon.sprite_url && (
          <img
            src={pokemon.sprite_url}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            className="size-10 [image-rendering:pixelated]"
          />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs text-muted-foreground tabular-nums">
            {dexNumber(pokemon.id)}
          </span>
          <TypeBadges types={pokemon.types} />
        </div>
      </div>
      {reason ? (
        <span className="shrink-0 text-xs text-muted-foreground">
          {m.team_cant_add({ reason })}
        </span>
      ) : (
        <Button
          variant="outline"
          size="sm"
          aria-label={m.team_add_named({ name })}
          onClick={onAdd}
          className="shrink-0"
        >
          <Plus aria-hidden="true" />
          {m.team_add()}
        </Button>
      )}
    </li>
  )
}
