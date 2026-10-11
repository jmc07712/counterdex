import type { TeamMember } from '@/api'
import { cn } from '@/lib/utils'

import { memberColors, MUTED } from '../utils/member-colors'
import { MemberBall } from './member-ball'
import { MemberSprite } from './member-sprite'

type MemberThumbProps = { member: TeamMember; className?: string }

/**
 * A member's sprite on a small tile in its main type's color, or muted once it's no longer in the
 * Pokédex. It's decoration: the member's name goes beside it.
 */
export function MemberThumb({ member, className }: MemberThumbProps) {
  const colors = memberColors(member)
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: colors?.background }}
      className={cn(
        'relative isolate block shrink-0 overflow-hidden rounded-lg',
        !colors && MUTED,
        className,
      )}
    >
      <MemberBall member={member} className="absolute -inset-[10%] -z-10" />
      <MemberSprite member={member} loading="lazy" />
    </span>
  )
}
