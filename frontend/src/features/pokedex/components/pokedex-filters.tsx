import { type Ref, useId } from 'react'

import { FormFilter } from '@/api'
import { ChoiceToggle, ChoiceToggles } from '@/components/filters/choice-toggles'
import { FilterBar } from '@/components/filters/filter-bar'
import { FilterGroup } from '@/components/filters/filter-group'
import { TypeFilter } from '@/components/filters/type-filter'
import { MAX_TYPES } from '@/components/pokemon/pokemon-types'
import { parseOption } from '@/lib/search-params'
import { m } from '@/paraglide/messages.js'

import { type PokedexFilters as Filters, POKEDEX_VIEWS } from '../hooks/use-pokedex-filters'
import { PokemonSearch } from './pokemon-search'

type PokedexFiltersProps = {
  filters: Filters
  onChange: (filters: Filters) => void
  onOpenPokemon: (pokemonId: number) => void
  searchRef?: Ref<HTMLInputElement>
}

export function PokedexFilters({
  filters,
  onChange,
  onOpenPokemon,
  searchRef,
}: PokedexFiltersProps) {
  const formsId = useId()
  const viewId = useId()

  return (
    <FilterBar
      search={
        <PokemonSearch
          value={filters.search}
          onChange={(search) => onChange({ ...filters, search })}
          onOpen={onOpenPokemon}
          inputRef={searchRef}
        />
      }
      choices={
        <>
          <FilterGroup
            id={formsId}
            label={m.pokedex_forms_label()}
            infoLabel={m.pokedex_forms_info_label()}
            info={m.pokedex_forms_info()}
          >
            <ChoiceToggles
              labelledBy={formsId}
              value={filters.forms}
              onChange={(value) => {
                const forms = parseOption(Object.values(FormFilter), value)
                if (forms) onChange({ ...filters, forms })
              }}
            >
              {Object.values(FormFilter).map((forms) => (
                <ChoiceToggle key={forms} value={forms}>
                  {m.pokedex_forms_option({ forms })}
                </ChoiceToggle>
              ))}
            </ChoiceToggles>
          </FilterGroup>
          <FilterGroup
            id={viewId}
            label={m.pokedex_view_label()}
            infoLabel={m.pokedex_view_info_label()}
            info={m.pokedex_view_info()}
          >
            <ChoiceToggles
              labelledBy={viewId}
              value={filters.view}
              onChange={(value) => {
                const view = parseOption(POKEDEX_VIEWS, value)
                if (view) onChange({ ...filters, view })
              }}
            >
              {POKEDEX_VIEWS.map((view) => (
                <ChoiceToggle key={view} value={view}>
                  {m.pokedex_view_option({ view })}
                </ChoiceToggle>
              ))}
            </ChoiceToggles>
          </FilterGroup>
        </>
      }
    >
      <TypeFilter
        value={filters.types}
        onChange={(types) => onChange({ ...filters, types })}
        info={m.pokedex_types_info({ max: MAX_TYPES })}
      />
    </FilterBar>
  )
}
