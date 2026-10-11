import type { ReactNode } from 'react'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type ChoiceTogglesProps = {
  // The id of the element that names the choices.
  labelledBy: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}

/** A row of joined toggles, one of which is always chosen. */
export function ChoiceToggles({ labelledBy, value, onChange, children }: ChoiceTogglesProps) {
  return (
    <ToggleGroup
      type="single"
      aria-labelledby={labelledBy}
      variant="outline"
      size="sm"
      spacing={0}
      value={value}
      onValueChange={(chosen) => {
        // Choosing the current option again would clear it; it stays chosen instead.
        if (chosen) onChange(chosen)
      }}
    >
      {children}
    </ToggleGroup>
  )
}

export function ChoiceToggle({ value, children }: { value: string; children: ReactNode }) {
  return (
    <ToggleGroupItem value={value} className="px-3">
      {children}
    </ToggleGroupItem>
  )
}
