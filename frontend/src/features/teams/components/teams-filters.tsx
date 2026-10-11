import { type Ref, useId } from 'react'

import { ChoiceToggle, ChoiceToggles } from '@/components/filters/choice-toggles'
import { FilterBar } from '@/components/filters/filter-bar'
import { FilterGroup } from '@/components/filters/filter-group'
import { SearchInput } from '@/components/filters/search-input'
import { TypeFilter } from '@/components/filters/type-filter'
import { parseOption } from '@/lib/search-params'
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
  const scopeId = useId()
  const viewId = useId()
  const sortId = useId()

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
            <FilterGroup
              id={scopeId}
              label={m.teams_scope_label()}
              infoLabel={m.teams_scope_info_label()}
              info={m.teams_scope_info()}
            >
              <ChoiceToggles
                labelledBy={scopeId}
                value={filters.scope}
                onChange={(value) => {
                  const scope = parseOption(TEAMS_SCOPES, value)
                  if (scope) onChange({ ...filters, scope })
                }}
              >
                {TEAMS_SCOPES.map((scope) => (
                  <ChoiceToggle key={scope} value={scope}>
                    {m.teams_scope_option({ scope })}
                  </ChoiceToggle>
                ))}
              </ChoiceToggles>
            </FilterGroup>
          )}
          <FilterGroup
            id={viewId}
            label={m.teams_view_label()}
            infoLabel={m.teams_view_info_label()}
            info={m.teams_view_info()}
          >
            <ChoiceToggles
              labelledBy={viewId}
              value={filters.view}
              onChange={(value) => {
                const view = parseOption(TEAMS_VIEWS, value)
                if (view) onChange({ ...filters, view })
              }}
            >
              {TEAMS_VIEWS.map((view) => (
                <ChoiceToggle key={view} value={view}>
                  {m.teams_view_option({ view })}
                </ChoiceToggle>
              ))}
            </ChoiceToggles>
          </FilterGroup>
          <FilterGroup
            id={sortId}
            label={m.teams_sort_label()}
            infoLabel={m.teams_sort_info_label()}
            info={m.teams_sort_info()}
          >
            <ChoiceToggles
              labelledBy={sortId}
              value={filters.sort}
              onChange={(value) => {
                const sort = parseOption(TEAMS_SORTS, value)
                if (sort) onChange({ ...filters, sort })
              }}
            >
              {TEAMS_SORTS.map((sort) => (
                <ChoiceToggle key={sort} value={sort}>
                  {m.teams_sort_option({ sort })}
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
        info={m.teams_types_info()}
      />
    </FilterBar>
  )
}
