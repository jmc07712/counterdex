import { useState } from 'react'

import type {
  EvolutionMethod,
  EvolutionTrigger,
  Gender,
  RelativePhysicalStats,
  TimeOfDay,
} from '@/api'
import { displayName } from '@/components/pokemon/format'
import { Badge } from '@/components/ui/badge'

// PokéAPI's item sprites, from the same CDN as its Pokémon sprites. Newer items have none.
const ITEM_SPRITES_URL = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/items/'

// Each Record covers every value the API can send, so a value it adds needs a label.

// What sets each evolution off.
const TRIGGER_LABELS: Record<EvolutionTrigger, string> = {
  'level-up': 'Level up',
  'in-battle-level-up': 'Level up in battle',
  'use-item': 'Use',
  trade: 'Trade',
  shed: 'Free party slot and a Poké Ball',
  spin: 'Spin around',
  'use-move': 'Use move',
  'agile-style-move': 'Agile Style',
  'strong-style-move': 'Strong Style',
  'take-damage': 'Take damage',
  'recoil-damage': 'Recoil damage',
  'three-critical-hits': '3 critical hits in a battle',
  'three-defeated-bisharp': 'Defeat 3 Bisharp',
  'tower-of-darkness': 'Tower of Darkness',
  'tower-of-waters': 'Tower of Waters',
  'gimmighoul-coins': '999 Gimmighoul Coins',
  'meltan-candies': '400 Meltan Candies',
  unclassified: 'Special',
}

const TIMES_OF_DAY: Record<TimeOfDay, string> = {
  day: 'Day',
  night: 'Night',
  dusk: 'Dusk',
  'full-moon': 'Full moon',
}

const GENDERS: Record<Gender, string> = { female: '♀ Female', male: '♂ Male' }

const PHYSICAL_STATS: Record<RelativePhysicalStats, string> = {
  'attack-higher': 'Attack > Defense',
  equal: 'Attack = Defense',
  'defense-higher': 'Attack < Defense',
}

type Condition = Exclude<keyof EvolutionMethod, 'trigger'>
type ConditionLabels = { [C in Condition]: (value: NonNullable<EvolutionMethod[C]>) => string }

// Each condition's chip, in the order shown. Typed over every condition the API sends, so one it
// adds needs a label.
const CONDITION_LABELS: ConditionLabels = {
  min_level: (level) => `Lv. ${level}`,
  item: displayName,
  held_item: displayName,
  known_move: (move) => `Knows ${displayName(move)}`,
  known_move_type: (type) => `Knows a ${displayName(type)} move`,
  used_move: displayName,
  min_move_count: (count) => `${count} times`,
  trade_species: (species) => `For ${displayName(species)}`,
  party_species: (species) => `${displayName(species)} in party`,
  party_type: (type) => `${displayName(type)} type in party`,
  min_happiness: () => 'High friendship',
  min_steps: (steps) => `${steps.toLocaleString('en')} steps`,
  min_damage_taken: (damage) => `${damage} damage`,
  relative_physical_stats: (stats) => PHYSICAL_STATS[stats],
  location: displayName,
  region: displayName,
  time_of_day: (time) => TIMES_OF_DAY[time],
  gender: (gender) => GENDERS[gender],
  needs_overworld_rain: () => 'Raining',
  needs_multiplayer: () => 'With another player',
  turn_upside_down: () => 'Console upside down',
  chance: (percent) => `${percent}% chance`,
}
const CONDITIONS = Object.keys(CONDITION_LABELS) as Condition[]

// A level-up's level, or the item used, already says what sets the evolution off.
const TRIGGER_SHOWN_BY: Partial<Record<EvolutionTrigger, Condition>> = {
  'level-up': 'min_level',
  'use-item': 'item',
}

/** One way a Pokémon evolves, as chips: "Lv. 16", or a Thunder Stone and "Alola". */
export function EvolutionMethodChips({ method }: { method: EvolutionMethod }) {
  const conditions = CONDITIONS.filter((condition) => method[condition])
  const shownBy = TRIGGER_SHOWN_BY[method.trigger]

  return (
    <ul aria-label="How it evolves" className="flex flex-wrap items-center gap-1">
      {!(shownBy && method[shownBy]) && (
        <li>
          <Badge variant="secondary">{TRIGGER_LABELS[method.trigger]}</Badge>
        </li>
      )}
      {conditions.map((condition) => (
        <li key={condition}>
          <Badge variant="outline">
            {(condition === 'item' || condition === 'held_item') && method[condition] && (
              <ItemSprite item={method[condition]} />
            )}
            {label(method, condition)}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

function label<C extends Condition>(method: EvolutionMethod, condition: C): string {
  // Typed by C, so TypeScript pairs this condition's value with this condition's label.
  const toLabel: ConditionLabels[C] = CONDITION_LABELS[condition]
  const value = method[condition]
  return value ? toLabel(value) : ''
}

function ItemSprite({ item }: { item: string }) {
  const [missing, setMissing] = useState(false)
  if (missing) return null
  return (
    <img
      src={`${ITEM_SPRITES_URL}${item}.png`}
      alt=""
      width={20}
      height={20}
      onError={() => setMissing(true)}
      className="-my-1 -ml-1 size-5 [image-rendering:pixelated]"
    />
  )
}
