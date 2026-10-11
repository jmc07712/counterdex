import type { PokemonType } from '@/api'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { m } from '@/paraglide/messages.js'

import { POKEMON_TYPES, TYPE_STYLES, toPokemonTypes } from './pokemon-types'

type TypeTogglesProps = {
  value: PokemonType[]
  // Radix lists the types in the order they were turned on, so the newest is last.
  onChange: (types: PokemonType[]) => void
  // The id of the element that names the toggles.
  labelledBy: string
  className?: string
}

/** A toggle for each type, filled with the type's color while it's on. */
export function TypeToggles({ value, onChange, labelledBy, className }: TypeTogglesProps) {
  return (
    <ToggleGroup
      type="multiple"
      aria-labelledby={labelledBy}
      variant="outline"
      size="sm"
      spacing={1.5}
      value={value}
      onValueChange={(values) => onChange(toPokemonTypes(values))}
      className={className}
    >
      {POKEMON_TYPES.map((type) => (
        <ToggleGroupItem
          key={type}
          value={type}
          style={{
            '--type': TYPE_STYLES[type].background,
            '--type-foreground': TYPE_STYLES[type].foreground,
          }}
          className="rounded-full transition-colors data-[state=on]:border-transparent data-[state=on]:bg-(--type) data-[state=on]:text-(--type-foreground)"
        >
          <span aria-hidden="true" className="size-2 rounded-full bg-(--type)" />
          {m.pokemon_type({ type })}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
