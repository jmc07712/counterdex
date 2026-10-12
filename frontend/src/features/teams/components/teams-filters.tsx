import type { Ref } from 'react'

import { FilterBar } from '@/components/filters/filter-bar'
import { OptionFilter } from '@/components/filters/option-filter'
import { SearchInput } from '@/components/filters/search-input'
import { TypeFilter } from '@/components/filters/type-filter'
import { m } from '@/paraglide/messages.js'

import {
  type TeamsFilters as Filters,
  TEAMS_SCOPES,
  TEAMS_SORTS,
  TEAMS_VIEWS,
} from '../hooks/use-teams-filters'

type TeamsFiltersProps = {
  filters: Filters
  onChange: (filters: Filters) => void
  // Whether to offer a choice of your own teams or everyone's, which only someone signed in has.
  showScope: boolean
  searchRef: Ref<HTMLInputElement>
}

export function TeamsFilters({ filters, onChange, showScope, searchRef }: TeamsFiltersProps) {
  return (
    <FilterBar
      search={
        <SearchInput
          ref={searchRef}
          aria-label={m.teams_search()}
          placeholder={m.teams_search()}
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
        />
      }
      choices={
        <>
          {showScope && (
            <OptionFilter
              label={m.teams_scope_label()}
              infoLabel={m.teams_scope_info_label()}
              info={m.teams_scope_info()}
              options={TEAMS_SCOPES}
              optionLabel={(scope) => m.teams_scope_option({ scope })}
              value={filters.scope}
              onChange={(scope) => onChange({ ...filters, scope })}
            />
          )}
          <OptionFilter
            label={m.teams_view_label()}
            infoLabel={m.teams_view_info_label()}
            info={m.teams_view_info()}
            options={TEAMS_VIEWS}
            optionLabel={(view) => m.teams_view_option({ view })}
            value={filters.view}
            onChange={(view) => onChange({ ...filters, view })}
          />
          <OptionFilter
            label={m.teams_sort_label()}
            infoLabel={m.teams_sort_info_label()}
            info={m.teams_sort_info()}
            options={TEAMS_SORTS}
            optionLabel={(sort) => m.teams_sort_option({ sort })}
            value={filters.sort}
            onChange={(sort) => onChange({ ...filters, sort })}
          />
        </>
      }
    >
      <TypeFilter
        value={filters.types}
        onChange={(types) => onChange({ ...filters, types })}
        info={m.teams_types_info()}
      />
    </FilterBar>
  )
}
