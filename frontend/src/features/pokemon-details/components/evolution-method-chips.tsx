import { type ReactNode, useState } from 'react'

import type { EvolutionMethod } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { itemSpriteUrl } from '@/components/pokemon/sprites'
import { Badge } from '@/components/ui/badge'
import { m } from '@/paraglide/messages.js'

/** One way a Pokémon evolves, as chips: "Lv. 16", or a Thunder Stone and "Alola". */
export function EvolutionMethodChips({ method }: { method: EvolutionMethod }) {
  // A level, or the item used, already says what sets the evolution off.
  const triggerShown =
    (method.trigger === 'level-up' && method.min_level != null) ||
    (method.trigger === 'use-item' && method.item != null)

  return (
    <ul aria-label={m.evolution_how()} className="flex flex-wrap items-center gap-1">
      {!triggerShown && (
        <Chip variant="secondary">{m.evolution_trigger({ trigger: method.trigger })}</Chip>
      )}
      {method.min_level != null && (
        <Chip>{m.evolution_min_level({ level: method.min_level })}</Chip>
      )}
      {method.item != null && (
        <Chip>
          <ItemSprite item={method.item} />
          {displayName(method.item)}
        </Chip>
      )}
      {method.held_item != null && (
        <Chip>
          <ItemSprite item={method.held_item} />
          {displayName(method.held_item)}
        </Chip>
      )}
      {method.known_move != null && (
        <Chip>{m.evolution_known_move({ move: displayName(method.known_move) })}</Chip>
      )}
      {method.known_move_type != null && (
        <Chip>
          {m.evolution_known_move_type({ type: m.pokemon_type({ type: method.known_move_type }) })}
        </Chip>
      )}
      {method.used_move != null && <Chip>{displayName(method.used_move)}</Chip>}
      {method.min_move_count != null && (
        <Chip>{m.evolution_min_move_count({ count: method.min_move_count })}</Chip>
      )}
      {method.trade_species != null && (
        <Chip>{m.evolution_trade_species({ species: displayName(method.trade_species) })}</Chip>
      )}
      {method.party_species != null && (
        <Chip>{m.evolution_party_species({ species: displayName(method.party_species) })}</Chip>
      )}
      {method.party_type != null && (
        <Chip>{m.evolution_party_type({ type: m.pokemon_type({ type: method.party_type }) })}</Chip>
      )}
      {method.min_happiness != null && <Chip>{m.evolution_high_friendship()}</Chip>}
      {method.min_steps != null && (
        <Chip>{m.evolution_min_steps({ count: method.min_steps })}</Chip>
      )}
      {method.min_damage_taken != null && (
        <Chip>{m.evolution_min_damage_taken({ damage: method.min_damage_taken })}</Chip>
      )}
      {method.relative_physical_stats != null && (
        <Chip>{m.evolution_physical_stats({ stats: method.relative_physical_stats })}</Chip>
      )}
      {method.location != null && <Chip>{displayName(method.location)}</Chip>}
      {method.region != null && <Chip>{displayName(method.region)}</Chip>}
      {method.time_of_day != null && (
        <Chip>{m.evolution_time_of_day({ time: method.time_of_day })}</Chip>
      )}
      {method.gender != null && <Chip>{m.evolution_gender({ gender: method.gender })}</Chip>}
      {method.needs_overworld_rain && <Chip>{m.evolution_raining()}</Chip>}
      {method.needs_multiplayer && <Chip>{m.evolution_with_another_player()}</Chip>}
      {method.turn_upside_down && <Chip>{m.evolution_console_upside_down()}</Chip>}
      {method.chance != null && <Chip>{m.evolution_chance({ percent: method.chance })}</Chip>}
    </ul>
  )
}

function Chip({
  variant = 'outline',
  children,
}: {
  variant?: 'outline' | 'secondary'
  children: ReactNode
}) {
  return (
    <li>
      <Badge variant={variant}>{children}</Badge>
    </li>
  )
}

function ItemSprite({ item }: { item: string }) {
  const [missing, setMissing] = useState(false)
  if (missing) return null
  return (
    <img
      src={itemSpriteUrl(item)}
      alt=""
      width={20}
      height={20}
      onError={() => setMissing(true)}
      className="-my-1 -ml-1 size-5 [image-rendering:pixelated]"
    />
  )
}
