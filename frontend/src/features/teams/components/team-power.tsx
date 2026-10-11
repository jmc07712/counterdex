import type { TeamMember } from '@/api'
import { statTotal } from '@/components/pokemon/format'
import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { MAX_TEAM_POWER, teamPower } from '../utils/team-power'

type TeamPowerProps = { members: TeamMember[]; className?: string }

/**
 * A team's power, as a number and a meter whose bar is built from its members in battle order:
 * each adds a segment as long as its base stat total, in its main type's color.
 */
export function TeamPower({ members, className }: TeamPowerProps) {
  const power = teamPower(members)
  // A team of special forms, such as Mega Evolutions, can go past MAX_TEAM_POWER and fill the bar.
  const max = Math.max(power, MAX_TEAM_POWER)
  return (
    <div
      role="meter"
      aria-label={m.team_power_label()}
      aria-valuenow={power}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuetext={m.team_power_amount({ power })}
      title={m.team_power_description()}
      className={cn('flex items-center gap-2 text-sm', className)}
    >
      <span className="text-muted-foreground">{m.team_power()}</span>
      <span className="font-semibold">{m.team_power_amount({ power })}</span>
      <span className="flex h-2 min-w-16 flex-1 gap-0.5 overflow-hidden rounded-full bg-muted">
        {members.map((member) => (
          <span
            key={member.pokemon.id}
            style={{
              width: `${(statTotal(member.pokemon.stats) / max) * 100}%`,
              backgroundColor: member.removed_at
                ? undefined
                : TYPE_STYLES[member.pokemon.types[0]].background,
            }}
            className={cn('shrink-0 last:rounded-r-full', member.removed_at && 'bg-muted-foreground/50')}
          />
        ))}
      </span>
    </div>
  )
}
