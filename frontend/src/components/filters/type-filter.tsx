import { useId } from 'react'

import type { PokemonType } from '@/api'
import { TypeToggles } from '@/components/pokemon/type-toggles'
import { m } from '@/paraglide/messages.js'

import { FilterGroup } from './filter-group'

type TypeFilterProps = {
  value: PokemonType[]
  onChange: (types: PokemonType[]) => void
  // What picking types does, for the info button.
  info: string
}

/** The filter bar's row of type toggles. */
export function TypeFilter({ value, onChange, info }: TypeFilterProps) {
  const id = useId()
  return (
    <FilterGroup
      id={id}
      label={m.pokemon_types()}
      infoLabel={m.filters_types_info_label()}
      info={info}
      className="items-start"
    >
      {/* One swipeable row on phones, beside the label; wraps on wider screens. */}
      <div className="-mr-4 min-w-0 flex-1 overflow-x-auto pr-4 [scrollbar-width:none] sm:mr-0 sm:overflow-visible sm:pr-0">
        <TypeToggles
          labelledBy={id}
          value={value}
          onChange={onChange}
          className="w-max sm:w-auto sm:flex-wrap"
        />
      </div>
    </FilterGroup>
  )
}
