import { ChevronDown, LoaderCircle, LogIn, Plus, RotateCw } from 'lucide-react'
import { useId, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'

import type { Pokemon, Team, TeamMember } from '@/api'
import { displayName } from '@/components/pokemon/format'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { paths } from '@/config/paths'
import { useCurrentUser } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { m } from '@/paraglide/messages.js'

import { useAddTeamMember } from '../hooks/use-add-team-member'
import { useCreateTeam } from '../hooks/use-create-team'
import { useUserTeams } from '../hooks/use-user-teams'
import { cantAdd, familyMember, MAX_TEAM_SIZE } from '../utils/can-add'
import { teamProblem } from '../utils/team-change-error'

type AddToTeamMenuProps = {
  pokemon: Pokemon
  // The button's classes, such as its width.
  className?: string
}

/**
 * A button that opens a menu of your teams, each with how many Pokémon it has, to add a Pokémon
 * to one; those it can't join say why. New team makes a team with the Pokémon and opens it to
 * edit. Signed out, the menu links to signing in, which comes back to this page.
 */
export function AddToTeamMenu({ pokemon, className }: AddToTeamMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={m.team_add_to_named({ name: displayName(pokemon.name) })}
          className={className}
        >
          <Plus aria-hidden="true" />
          {m.team_add_to()}
          <ChevronDown aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        collisionPadding={16}
        // Up to 20rem tall, not as tall as the room below the button when it opened, so it can
        // grow as your teams load and move above the button if it fits better there.
        className="max-h-[min(20rem,calc(100dvh-2rem))] w-64"
      >
        {/* Rendered only while the menu is open, so who's signed in and their teams are asked
            for only then. */}
        <MenuItems pokemon={pokemon} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MenuItems({ pokemon }: { pokemon: Pokemon }) {
  const currentUser = useCurrentUser()
  const user = currentUser.data
  if (user) return <YourTeams pokemon={pokemon} username={user.username} />
  if (user === null) return <SignInItem />
  if (currentUser.isError) return <LoadFailedItem onRetry={() => void currentUser.refetch()} />
  return <LoadingItem />
}

function YourTeams({ pokemon, username }: { pokemon: Pokemon; username: string }) {
  const teams = useUserTeams(username)
  if (teams.isPending) return <LoadingItem />
  if (teams.isError) return <LoadFailedItem onRetry={() => void teams.refetch()} />
  return (
    <>
      {teams.data.length > 0 && (
        <>
          <DropdownMenuLabel>{m.team_add_to_yours()}</DropdownMenuLabel>
          {teams.data.map((team) => (
            <TeamItem key={team.id} team={team} pokemon={pokemon} />
          ))}
          <DropdownMenuSeparator />
        </>
      )}
      <NewTeamItem pokemon={pokemon} teamCount={teams.data.length} />
    </>
  )
}

function TeamItem({ team, pokemon }: { team: Team; pokemon: Pokemon }) {
  const add = useAddTeamMember(team)
  const navigate = useNavigate()
  const canAdd = cantAdd(team.members, pokemon) === null

  async function addPokemon() {
    const added = await add(pokemon)
    if (!added) return
    toast.success(m.team_added({ name: displayName(pokemon.name), team: added.name }), {
      action: { label: m.team_show(), onClick: () => void navigate(paths.team.getHref(team.id)) },
    })
  }

  return (
    <DropdownMenuItem
      // aria-disabled rather than disabled when it can't take the Pokémon, so it can still be
      // reached with the arrow keys and why read out.
      aria-disabled={!canAdd}
      data-disabled={canAdd ? undefined : ''}
      onSelect={(event) => {
        if (canAdd) void addPokemon()
        else event.preventDefault()
      }}
      // Not faded when it can't take the Pokémon: its name is muted instead, so the reason under
      // it reads clearly.
      className="data-disabled:opacity-100"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className={cn('truncate', !canAdd && 'text-muted-foreground')}>{team.name}</p>
          <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {m.team_member_count({ count: team.members.length, max: MAX_TEAM_SIZE })}
          </p>
        </div>
        {!canAdd && (
          <p className="text-xs">
            <CantAddReason members={team.members} pokemon={pokemon} />
          </p>
        )}
      </div>
    </DropdownMenuItem>
  )
}

// Why the members can't take the Pokémon: it's one of them, one is from its family, or there's
// no room.
function CantAddReason({ members, pokemon }: { members: TeamMember[]; pokemon: Pokemon }) {
  const relative = familyMember(members, pokemon)
  if (relative?.pokemon.id === pokemon.id) return m.team_on_team()
  if (relative) return m.team_family_on_team({ member: displayName(relative.pokemon.name) })
  return m.team_full()
}

function NewTeamItem({ pokemon, teamCount }: { pokemon: Pokemon; teamCount: number }) {
  const create = useCreateTeam()
  const navigate = useNavigate()
  // One id for every try while the menu is open, so trying again after an answer that never came
  // gets the team the API already made, not a second one. Opening the menu again makes a new id.
  const [id] = useState(() => crypto.randomUUID())

  return (
    <DropdownMenuItem
      disabled={create.isPending}
      onSelect={(event) => {
        // Stays open while creating, to say so. Once created, the team opens to edit.
        event.preventDefault()
        create
          .mutateAsync({
            id,
            name: m.team_default_name({ number: teamCount + 1 }),
            pokemonIds: [pokemon.id],
          })
          .then(
            (team) => void navigate(paths.teamEdit.getHref(team.id)),
            (error: Error) => toast.error(m.team_problem({ problem: teamProblem(error) })),
          )
      }}
    >
      <Plus aria-hidden="true" />
      {create.isPending ? m.teams_creating() : m.teams_new()}
    </DropdownMenuItem>
  )
}

// Signing in comes back to this page, with whatever it shows open.
function SignInItem() {
  const { pathname, search } = useLocation()
  const reasonId = useId()
  return (
    <>
      <DropdownMenuLabel id={reasonId} className="font-normal">
        {m.team_add_to_signed_out()}
      </DropdownMenuLabel>
      <DropdownMenuItem asChild aria-describedby={reasonId}>
        <Link to={paths.signIn.getHref(pathname + search)}>
          <LogIn aria-hidden="true" />
          {m.auth_go_to_sign_in()}
        </Link>
      </DropdownMenuItem>
    </>
  )
}

function LoadingItem() {
  return (
    <DropdownMenuItem disabled>
      <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
      {m.team_add_to_loading()}
    </DropdownMenuItem>
  )
}

function LoadFailedItem({ onRetry }: { onRetry: () => void }) {
  const problemId = useId()
  return (
    <>
      <DropdownMenuLabel id={problemId} className="font-normal">
        {m.team_add_to_load_failed()}
      </DropdownMenuLabel>
      <DropdownMenuItem
        aria-describedby={problemId}
        onSelect={(event) => {
          // Stays open, to show your teams once they load.
          event.preventDefault()
          onRetry()
        }}
      >
        <RotateCw aria-hidden="true" />
        {m.common_try_again()}
      </DropdownMenuItem>
    </>
  )
}
