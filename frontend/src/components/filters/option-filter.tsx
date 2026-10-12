import { useId } from 'react'

import { parseOption } from '@/lib/search-params'

import { ChoiceToggle, ChoiceToggles } from './choice-toggles'
import { FilterGroup } from './filter-group'

type OptionFilterProps<T extends string> = {
  label: string
  infoLabel: string
  info: string
  options: readonly T[]
  // The words on an option's toggle.
  optionLabel: (option: T) => string
  value: T
  onChange: (value: T) => void
}

/** A filter bar's choice of one of `options`, as a row of joined toggles after its label. */
export function OptionFilter<T extends string>({
  label,
  infoLabel,
  info,
  options,
  optionLabel,
  value,
  onChange,
}: OptionFilterProps<T>) {
  const id = useId()
  return (
    <FilterGroup id={id} label={label} infoLabel={infoLabel} info={info}>
      <ChoiceToggles
        labelledBy={id}
        value={value}
        onChange={(chosen) => {
          const option = parseOption(options, chosen)
          if (option) onChange(option)
        }}
      >
        {options.map((option) => (
          <ChoiceToggle key={option} value={option}>
            {optionLabel(option)}
          </ChoiceToggle>
        ))}
      </ChoiceToggles>
    </FilterGroup>
  )
}
