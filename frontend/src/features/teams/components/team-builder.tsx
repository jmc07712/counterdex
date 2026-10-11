import { ArrowLeft } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'

import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

import type { TeamEditor } from '../types'
import { addToTeam } from '../utils/add-to-team'
import { SlotPicker } from './slot-picker'
import { TeamNameField } from './team-name-field'
import { TeamSlots } from './team-slots'

type TeamBuilderProps = {
  editor: TeamEditor
  // Beside the name, such as a menu with Delete.
  actions?: ReactNode
  // Above the slots, such as a guest's "Kept in this browser".
  notice?: ReactNode
}

/** A team's name and six slots, for a saved team or a guest's draft alike. */
export function TeamBuilder({ editor, actions, notice }: TeamBuilderProps) {
  const [picking, setPicking] = useState(false)
  const { team } = editor

  return (
    <>
      <Link
        to={paths.home.getHref()}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {m.team_all_teams()}
      </Link>
      <div className="mb-6 flex items-center gap-2">
        <h1 className="sr-only">{team.name}</h1>
        <TeamNameField
          name={team.name}
          onRename={(name) => void editor.change({ kind: 'rename', name })}
        />
        {actions}
      </div>
      {notice}
      <TeamSlots
        members={team.members}
        onRemove={(pokemonId) => void editor.change({ kind: 'remove', pokemonId })}
        onAdd={() => setPicking(true)}
      />
      <SlotPicker
        open={picking}
        onOpenChange={setPicking}
        teamName={team.name}
        members={team.members}
        onPick={(pokemon) => {
          setPicking(false)
          void addToTeam(editor, pokemon, { teamName: team.name })
        }}
      />
    </>
  )
}
