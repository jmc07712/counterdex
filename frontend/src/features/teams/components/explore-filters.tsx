import { type Ref, useId } from 'react'

import { ChoiceToggle, ChoiceToggles } from '@/components/filters/choice-toggles'
import { FilterBar } from '@/components/filters/filter-bar'
import { FilterGroup } from '@/components/filters/filter-group'
import { SearchInput } from '@/components/filters/search-input'
import { TypeFilter } from '@/components/filters/type-filter'
import { parseOption } from '@/lib/search-params'
import { m } from '@/paraglide/messages.js'

import { EXPLORE_VIEWS, type ExploreFilters as Filters } from '../hooks/use-explore-filters'

type ExploreFiltersProps = {
  filters: Filters
  onChange: (filters: Filters) => void
  searchRef?: Ref<HTMLInputElement>
}

export function ExploreFilters({ filters, onChange, searchRef }: ExploreFiltersProps) {
  const viewId = useId()

  return (
    <FilterBar
      search={
        <SearchInput
          ref={searchRef}
          aria-label={m.explore_search()}
          placeholder={m.explore_search()}
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
        />
      }
      choices={
        <FilterGroup
          id={viewId}
          label={m.explore_view_label()}
          infoLabel={m.explore_view_info_label()}
          info={m.explore_view_info()}
        >
          <ChoiceToggles
            labelledBy={viewId}
            value={filters.view}
            onChange={(value) => {
              const view = parseOption(EXPLORE_VIEWS, value)
              if (view) onChange({ ...filters, view })
            }}
          >
            {EXPLORE_VIEWS.map((view) => (
              <ChoiceToggle key={view} value={view}>
                {m.explore_view_option({ view })}
              </ChoiceToggle>
            ))}
          </ChoiceToggles>
        </FilterGroup>
      }
    >
      <TypeFilter
        value={filters.types}
        onChange={(types) => onChange({ ...filters, types })}
        info={m.explore_types_info()}
      />
    </FilterBar>
  )
}
