import type { Ref } from 'react'

import { FormFilter } from '@/api'
import { FilterBar } from '@/components/filters/filter-bar'
import { OptionFilter } from '@/components/filters/option-filter'
import { TypeFilter } from '@/components/filters/type-filter'
import { MAX_TYPES } from '@/components/pokemon/pokemon-types'
import { m } from '@/paraglide/messages.js'

import { POKEDEX_VIEWS } from '../hooks/use-pokedex-filters'
import type { PokedexFilters as Filters } from '../types'
import { PokemonSearch } from './pokemon-search'

type PokedexFiltersProps = {
  filters: Filters
  onChange: (filters: Filters) => void
  onOpenPokemon: (pokemonId: number) => void
  searchRef: Ref<HTMLInputElement>
}

export function PokedexFilters({
  filters,
  onChange,
  onOpenPokemon,
  searchRef,
}: PokedexFiltersProps) {
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
          <OptionFilter
            label={m.pokedex_forms_label()}
            infoLabel={m.pokedex_forms_info_label()}
            info={m.pokedex_forms_info()}
            options={Object.values(FormFilter)}
            optionLabel={(forms) => m.pokedex_forms_option({ forms })}
            value={filters.forms}
            onChange={(forms) => onChange({ ...filters, forms })}
          />
          <OptionFilter
            label={m.pokedex_view_label()}
            infoLabel={m.pokedex_view_info_label()}
            info={m.pokedex_view_info()}
            options={POKEDEX_VIEWS}
            optionLabel={(view) => m.pokedex_view_option({ view })}
            value={filters.view}
            onChange={(view) => onChange({ ...filters, view })}
          />
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
