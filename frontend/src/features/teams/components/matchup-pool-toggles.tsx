import { Check } from 'lucide-react'
import { type ReactNode, useId } from 'react'

import { FilterGroup } from '@/components/filters/filter-group'
import { Toggle } from '@/components/ui/toggle'
import { m } from '@/paraglide/messages.js'

import type { MatchupPool } from '../types'

type MatchupPoolTogglesProps = {
  pool: MatchupPool
  onChange: (pool: MatchupPool) => void
}

/** A toggle each for picking from alternate forms and from legendaries too, both off to begin. */
export function MatchupPoolToggles({ pool, onChange }: MatchupPoolTogglesProps) {
  const labelId = useId()
  return (
    <FilterGroup
      id={labelId}
      label={m.team_pool_label()}
      infoLabel={m.team_pool_info_label()}
      info={m.team_pool_info()}
      className="flex-wrap"
    >
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
        <PoolToggle pressed={pool.forms} onPressedChange={(forms) => onChange({ ...pool, forms })}>
          {m.team_pool_forms()}
        </PoolToggle>
        <PoolToggle
          pressed={pool.legendaries}
          onPressedChange={(legendaries) => onChange({ ...pool, legendaries })}
        >
          {m.team_pool_legendaries()}
        </PoolToggle>
      </div>
    </FilterGroup>
  )
}

type PoolToggleProps = {
  pressed: boolean
  onPressedChange: (pressed: boolean) => void
  children: ReactNode
}

// Filled, and checked, while it's on.
function PoolToggle({ pressed, onPressedChange, children }: PoolToggleProps) {
  return (
    <Toggle
      variant="outline"
      size="sm"
      pressed={pressed}
      onPressedChange={onPressedChange}
      className="rounded-full data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background"
    >
      {pressed && <Check aria-hidden="true" />}
      {children}
    </Toggle>
  )
}
