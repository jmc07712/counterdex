import { Search } from 'lucide-react'

import { FormFilter } from '@/api'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import { displayName } from './format'
import { POKEMON_TYPES, TYPE_STYLES, toPokemonTypes } from './pokemon-types'
import { type PokedexFilters as Filters, parseFormFilter } from './use-pokedex-filters'

const FORM_OPTIONS: Record<FormFilter, string> = {
  all: 'All',
  default: 'Standard',
  alternate: 'Alternate',
}

type PokedexFiltersProps = {
  filters: Filters
  onChange: (filters: Filters) => void
}

export function PokedexFilters({ filters, onChange }: PokedexFiltersProps) {
  return (
    <section
      aria-label="Filters"
      // Pinned below the header on wider screens; on phones it would take a fifth of the screen.
      className="-mx-4 mb-6 flex flex-col gap-3 border-b bg-background px-4 py-3 sm:sticky sm:top-14 sm:z-30 sm:-mx-6 sm:px-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Search Pokémon"
            placeholder="Search Pokémon"
            value={filters.search}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            className="pl-8"
          />
        </div>
        <ToggleGroup
          type="single"
          aria-label="Forms"
          variant="outline"
          size="sm"
          spacing={0}
          value={filters.forms}
          // Choosing the current option again would clear it; one option always stays chosen.
          onValueChange={(value) => {
            const forms = parseFormFilter(value)
            if (forms) onChange({ ...filters, forms })
          }}
          className="self-start sm:self-auto"
        >
          {Object.values(FormFilter).map((forms) => (
            <ToggleGroupItem key={forms} value={forms} className="px-3">
              {FORM_OPTIONS[forms]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* One swipeable row on phones; wraps on wider screens. */}
      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0">
        <ToggleGroup
          type="multiple"
          aria-label="Types"
          variant="outline"
          size="sm"
          spacing={1.5}
          value={filters.types}
          // Radix lists selections in the order they were made, so the filters keep the newest.
          onValueChange={(values) => onChange({ ...filters, types: toPokemonTypes(values) })}
          className="w-max sm:w-auto sm:flex-wrap"
        >
          {POKEMON_TYPES.map((type) => (
            <ToggleGroupItem
              key={type}
              value={type}
              style={{
                '--type': TYPE_STYLES[type].background,
                '--type-foreground': TYPE_STYLES[type].foreground,
              }}
              className="rounded-full transition-colors data-[state=on]:border-transparent data-[state=on]:bg-(--type) data-[state=on]:text-(--type-foreground)"
            >
              <span aria-hidden="true" className="size-2 rounded-full bg-(--type)" />
              {displayName(type)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </section>
  )
}
