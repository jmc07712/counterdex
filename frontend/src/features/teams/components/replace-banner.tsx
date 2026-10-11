import { Replace } from 'lucide-react'

import type { TeamMember } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { Alert, AlertAction, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { m } from '@/paraglide/messages.js'

type ReplaceBannerProps = { member: TeamMember; onCancel: () => void; className?: string }

/** While a member is being replaced, a box asking for the Pokémon to put in its place. */
export function ReplaceBanner({ member, onCancel, className }: ReplaceBannerProps) {
  return (
    <Alert role="status" className={className}>
      <Replace />
      <AlertTitle>{m.team_replace_choose({ name: displayName(member.pokemon.name) })}</AlertTitle>
      <AlertAction>
        <Button variant="outline" size="sm" onClick={onCancel}>
          {m.common_cancel()}
        </Button>
      </AlertAction>
    </Alert>
  )
}
