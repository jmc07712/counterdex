import type { ComponentProps } from 'react'

import type { TeamMember } from '@/api'
import { cn } from '@/lib/utils'

type MemberSpriteProps = { member: TeamMember } & ComponentProps<'img'>

/**
 * A member's sprite, in gray once it's no longer in the Pokédex. It hops while the element marked
 * group/hop around it is hovered or has keyboard focus.
 */
export function MemberSprite({ member, className, ...props }: MemberSpriteProps) {
  if (!member.pokemon.sprite_url) return null
  return (
    <img
      src={member.pokemon.sprite_url}
      alt=""
      width={96}
      height={96}
      className={cn(
        // PokéAPI sprites have transparent margins; scaling up fills them.
        'size-full scale-125 object-contain drop-shadow-[0_4px_4px_rgb(0_0_0/0.3)] [image-rendering:pixelated]',
        'motion-safe:group-hover/hop:animate-hop motion-safe:group-focus-visible/hop:animate-hop',
        member.removed_at && 'grayscale',
        className,
      )}
      {...props}
    />
  )
}
