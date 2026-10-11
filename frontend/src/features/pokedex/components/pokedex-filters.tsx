import { Info } from 'lucide-react'
import { type ReactNode, useId } from 'react'

import { FormFilter } from '@/api'
import { MAX_TYPES } from '@/components/pokemon/pokemon-types'
import { TypeToggles } from '@/components/pokemon/type-toggles'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import {
  type PokedexFilters as Filters,
  parseOption,
  POKEDEX_VIEWS,
} from '../hooks/use-pokedex-filters'
import { PokemonSearch } from './pokemon-search'

type PokedexFiltersProps = {
  filters: Filters
  onChange: (filters: Filters) => void
  onOpenPokemon: (pokemonId: number) => void
}

export function PokedexFilters({ filters, onChange, onOpenPokemon }: PokedexFiltersProps) {
  const formsId = useId()
  const viewId = useId()
  const typesId = useId()

  return (
    <section
      aria-label={m.pokedex_filters()}
      // Pinned below the header on wider screens; on phones it would take a fifth of the screen.
      className="-mx-4 mb-6 flex flex-col gap-3 border-b bg-background px-4 py-3 sm:sticky sm:top-14 sm:z-30 sm:-mx-6 sm:px-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <PokemonSearch
          value={filters.search}
          onChange={(search) => onChange({ ...filters, search })}
          onOpen={onOpenPokemon}
        />
        {/* Choosing the current option again would clear it; one option always stays chosen. */}
        <div className="flex flex-wrap gap-x-4 gap-y-3">
          <FilterGroup
            id={formsId}
            label={m.pokedex_forms_label()}
            infoLabel={m.pokedex_forms_info_label()}
            info={m.pokedex_forms_info()}
          >
            <ToggleGroup
              type="single"
              aria-labelledby={formsId}
              variant="outline"
              size="sm"
              spacing={0}
              value={filters.forms}
              onValueChange={(value) => {
                const forms = parseOption(Object.values(FormFilter), value)
                if (forms) onChange({ ...filters, forms })
              }}
            >
              {Object.values(FormFilter).map((forms) => (
                <ToggleGroupItem key={forms} value={forms} className="px-3">
                  {m.pokedex_forms_option({ forms })}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FilterGroup>
          <FilterGroup
            id={viewId}
            label={m.pokedex_view_label()}
            infoLabel={m.pokedex_view_info_label()}
            info={m.pokedex_view_info()}
          >
            <ToggleGroup
              type="single"
              aria-labelledby={viewId}
              variant="outline"
              size="sm"
              spacing={0}
              value={filters.view}
              onValueChange={(value) => {
                const view = parseOption(POKEDEX_VIEWS, value)
                if (view) onChange({ ...filters, view })
              }}
            >
              {POKEDEX_VIEWS.map((view) => (
                <ToggleGroupItem key={view} value={view} className="px-3">
                  {m.pokedex_view_option({ view })}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FilterGroup>
        </div>
      </div>

      <FilterGroup
        id={typesId}
        label={m.pokemon_types()}
        infoLabel={m.pokedex_types_info_label()}
        info={m.pokedex_types_info({ max: MAX_TYPES })}
        className="items-start"
      >
        {/* One swipeable row on phones, beside the label; wraps on wider screens. */}
        <div className="-mr-4 min-w-0 flex-1 overflow-x-auto pr-4 [scrollbar-width:none] sm:mr-0 sm:overflow-visible sm:pr-0">
          <TypeToggles
            labelledBy={typesId}
            value={filters.types}
            onChange={(types) => onChange({ ...filters, types })}
            className="w-max sm:w-auto sm:flex-wrap"
          />
        </div>
      </FilterGroup>
    </section>
  )
}

type FilterGroupProps = {
  // Names the group's controls, through their aria-labelledby.
  id: string
  label: string
  infoLabel: string
  info: string
  className?: string
  children: ReactNode
}

// The info button opens a popover rather than a tooltip, so it works on phones too.
function FilterGroup({ id, label, infoLabel, info, className, children }: FilterGroupProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* As tall as a row of toggles, so the label lines up with the first. */}
      <div className="flex h-7 shrink-0 items-center gap-0.5">
        <span id={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={infoLabel}
              className="text-muted-foreground"
            >
              <Info />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 text-sm">
            {info}
          </PopoverContent>
        </Popover>
      </div>
      {children}
    </div>
  )
}
