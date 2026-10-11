import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  addTeamMember,
  removeTeamMember,
  renameTeam,
  reorderTeam,
  replaceTeamMember,
  type Team,
} from '@/api'
import { m } from '@/paraglide/messages.js'

import { applyChange, type TeamChange } from '../utils/apply-change'
import { TeamChangeError, teamProblem } from '../utils/team-change-error'
import { teamQueryOptions } from './use-team'
import { teamsQueryKey } from './use-teams'

type Result = { data?: Team; error?: unknown; response?: Response }

async function unwrap(request: Promise<Result>): Promise<Team> {
  const { data, error, response } = await request
  if (data === undefined) throw new TeamChangeError(response, error)
  return data
}

function send(teamId: string, change: TeamChange): Promise<Team> {
  const path = { team_id: teamId }
  switch (change.kind) {
    case 'add':
      return unwrap(addTeamMember({ path, body: { pokemon_id: change.pokemon.id } }))
    case 'replace':
      return unwrap(
        replaceTeamMember({
          path: { ...path, pokemon_id: change.pokemonId },
          body: { pokemon_id: change.pokemon.id },
        }),
      )
    case 'remove':
      return unwrap(removeTeamMember({ path: { ...path, pokemon_id: change.pokemonId } }))
    case 'reorder':
      return unwrap(reorderTeam({ path, body: { pokemon_ids: change.pokemonIds } }))
    case 'rename':
      return unwrap(renameTeam({ path, body: { name: change.name } }))
  }
}

type Snapshot = { team: Team | null | undefined; teams: Team[] | undefined }

function snapshot(queryClient: QueryClient, teamId: string): Snapshot {
  return {
    team: queryClient.getQueryData(teamQueryOptions(teamId).queryKey),
    teams: queryClient.getQueryData(teamsQueryKey),
  }
}

function update(queryClient: QueryClient, teamId: string, change: (team: Team) => Team) {
  queryClient.setQueryData(teamQueryOptions(teamId).queryKey, (team) => team && change(team))
  queryClient.setQueryData(teamsQueryKey, (teams) =>
    teams?.map((team) => (team.id === teamId ? change(team) : team)),
  )
}

/**
 * Changes one of the signed-in user's teams, showing each change at once.
 *
 * Changes to a team are sent one at a time, in the order they were made, so a response can't
 * overtake an earlier one. The team is fetched again only after the last change waiting has
 * settled, so a fetch can't overwrite changes that are still on their way. A failed change is
 * undone, if no change was made on top of it, and says why.
 */
export function useTeamChanges(teamId: string) {
  const queryClient = useQueryClient()
  const mutationKey = ['team-change', teamId]
  const isLastChange = () => queryClient.isMutating({ mutationKey }) === 1

  const { mutateAsync } = useMutation({
    mutationKey,
    scope: { id: `team:${teamId}` },
    mutationFn: (change: TeamChange) => send(teamId, change),
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: teamQueryOptions(teamId).queryKey })
      await queryClient.cancelQueries({ queryKey: teamsQueryKey })
      const previous = snapshot(queryClient, teamId)
      update(queryClient, teamId, (team) => applyChange(team, change))
      return previous
    },
    onError: (error, _change, previous) => {
      if (previous && isLastChange()) {
        queryClient.setQueryData(teamQueryOptions(teamId).queryKey, previous.team)
        queryClient.setQueryData(teamsQueryKey, previous.teams)
      }
      toast.error(m.team_problem({ problem: teamProblem(error) }))
    },
    onSettled: () => {
      if (!isLastChange()) return
      void queryClient.invalidateQueries({ queryKey: teamQueryOptions(teamId).queryKey })
      void queryClient.invalidateQueries({ queryKey: teamsQueryKey })
    },
  })

  // Resolves to the team after the change, or undefined if it failed (onError has said why).
  return (change: TeamChange) => mutateAsync(change).catch(() => undefined)
}
