import { Check, Plus, Replace } from 'lucide-react'
import { type ReactNode, useId } from 'react'

import { type Pokemon, TeamConflictReason, type TeamMember } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { Button } from '@/components/ui/button'
import { m } from '@/paraglide/messages.js'

import type { TeamEditor } from '../types'
import { addToTeam } from '../utils/add-to-team'
import { cantAdd, familyMember } from '../utils/can-add'

type TeamCardActionProps = {
  editor: TeamEditor
  pokemon: Pokemon
  // The member a Pokémon is being chosen to replace, if any.
  replacing?: TeamMember
}

/**
 * On a Pokémon's card, what it can do for the team: join it, or take the place of the member from
 * its evolution family, or of the member being replaced; or why not, when it's on the team, the
 * team is full, or another member is from its family. It's the same button throughout, so focus
 * stays on it as the team changes.
 */
export function TeamCardAction({ editor, pokemon, replacing }: TeamCardActionProps) {
  const { members } = editor.team
  const name = displayName(pokemon.name)
  const relative = familyMember(members, pokemon)

  if (relative?.pokemon.id === pokemon.id) {
    return (
      <CardButton label={m.team_on_team_named({ name })} icon={<Check />}>
        {m.team_on_team()}
      </CardButton>
    )
  }
  if (replacing) {
    const member = displayName(replacing.pokemon.name)
    // It may be from the replaced member's own family, but not from another member's.
    const others = members.filter((each) => each.pokemon.id !== replacing.pokemon.id)
    const blocking = familyMember(others, pokemon)
    if (blocking) {
      return (
        <CardButton
          label={m.team_replace_with({ member, name })}
          note={m.team_family_on_team({ member: displayName(blocking.pokemon.name) })}
          icon={<Replace />}
        >
          {m.team_replace_named({ name: member })}
        </CardButton>
      )
    }
    return (
      <CardButton
        label={m.team_replace_with({ member, name })}
        icon={<Replace />}
        onPress={() => void editor.replace(replacing.pokemon.id, pokemon)}
      >
        {m.team_replace_named({ name: member })}
      </CardButton>
    )
  }
  if (relative) {
    const member = displayName(relative.pokemon.name)
    return (
      <CardButton
        label={m.team_replace_with({ member, name })}
        note={m.team_family_on_team({ member })}
        icon={<Replace />}
        onPress={() => void editor.replace(relative.pokemon.id, pokemon)}
      >
        {m.team_replace_named({ name: member })}
      </CardButton>
    )
  }
  if (cantAdd(members, pokemon) === TeamConflictReason.TEAM_FULL) {
    return <CardButton>{m.team_full()}</CardButton>
  }
  return (
    <CardButton
      label={m.team_add_named({ name })}
      icon={<Plus />}
      onPress={() => void addToTeam(editor, pokemon)}
    >
      {m.team_add()}
    </CardButton>
  )
}

type CardButtonProps = {
  // Its name, when its words don't say which Pokémon it's for.
  label?: string
  // Above it, why it does what it does.
  note?: string
  icon?: ReactNode
  // Without it, there's nothing to press, and the words say why.
  onPress?: () => void
  children: string
}

// aria-disabled rather than disabled when there's nothing to press, so it keeps focus.
function CardButton({ label, note, icon, onPress, children }: CardButtonProps) {
  const noteId = useId()
  return (
    <div className="flex flex-col gap-1.5">
      {note && (
        <p id={noteId} className="text-xs text-muted-foreground">
          {note}
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        aria-label={label}
        aria-describedby={note ? noteId : undefined}
        aria-disabled={!onPress}
        onClick={onPress}
        // A long name wraps onto a second line rather than being cut short.
        className="h-auto min-h-7 w-full py-1 whitespace-normal aria-disabled:cursor-default aria-disabled:bg-muted aria-disabled:text-muted-foreground"
      >
        {icon}
        {children}
      </Button>
    </div>
  )
}
