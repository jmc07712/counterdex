import type { TeamMember } from '@/api'
import { GhostBall } from '@/components/pokemon/poke-ball'
import { TypeBall } from '@/components/pokemon/type-ball'

type MemberBallProps = { member: TeamMember; className?: string }

/** The ball ghosted behind a member: its TypeBall, or one in the text color once it's removed. */
export function MemberBall({ member, className }: MemberBallProps) {
  if (member.removed_at) return <GhostBall className={className} />
  return <TypeBall types={member.pokemon.types} className={className} />
}
