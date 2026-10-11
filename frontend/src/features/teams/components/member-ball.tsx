import type { TeamMember } from '@/api'
import { PokeBall } from '@/components/pokemon/poke-ball'
import { TypeBall } from '@/components/pokemon/type-ball'
import { cn } from '@/lib/utils'

type MemberBallProps = { member: TeamMember; className?: string }

/** The ball ghosted behind a member: its TypeBall, or one in the text color once it's removed. */
export function MemberBall({ member, className }: MemberBallProps) {
  if (member.removed_at) return <PokeBall className={cn('opacity-40', className)} />
  return <TypeBall types={member.pokemon.types} className={className} />
}
