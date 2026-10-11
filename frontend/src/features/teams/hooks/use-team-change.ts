import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { Team } from '@/api'
import {
  listTeamsInfiniteQueryKey,
  listUserTeamsQueryKey,
} from '@/api/@tanstack/react-query.gen'
import { currentUserOptions } from '@/lib/auth'
import { m } from '@/paraglide/messages.js'

import { teamProblem } from '../utils/team-change-error'
import { teamQueryOptions } from './use-team'

/** Changes to one team share this scope, so they're sent one at a time, in order. */
export function teamChangeScope(teamId: string) {
  return { id: `team:${teamId}` }
}

type TeamChange<Variables> = {
  // Sends the change, resolving to the team as the API answers it.
  send: (variables: Variables) => Promise<Team>
  // The team as the change leaves it, shown until the API answers.
  apply: (team: Team, variables: Variables) => Team
}

/**
 * Makes one kind of change to a team, showing it at once.
 *
 * Changes to a team are sent one at a time, in the order they were made, so a response can't
 * overtake an earlier one. The team is fetched again only after the last change waiting has
 * settled, so a fetch can't overwrite changes that are still on their way. A refused change is
 * undone, if no change was made on top of it, and a toast says why. One refused because nobody is
 * signed in any more has who's signed in checked again.
 *
 * Returns a function that makes the change and resolves to the team after it, or to undefined
 * if it failed.
 */
export function useTeamChange<Variables>(team: Team, { send, apply }: TeamChange<Variables>) {
  const queryClient = useQueryClient()
  const teamKey = teamQueryOptions(team.id).queryKey
  const mutationKey = ['change-team', team.id]
  const isLastChange = () => queryClient.isMutating({ mutationKey }) === 1

  const { mutateAsync } = useMutation({
    mutationKey,
    scope: teamChangeScope(team.id),
    mutationFn: send,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: teamKey })
      const previous = queryClient.getQueryData(teamKey)
      queryClient.setQueryData(teamKey, (shown) => shown && apply(shown, variables))
      return { previous }
    },
    onError: (error, _variables, snapshot) => {
      if (snapshot && isLastChange()) queryClient.setQueryData(teamKey, snapshot.previous)
      const problem = teamProblem(error)
      // Asks again who's signed in, so the page stops offering changes the API won't take.
      if (problem === 'signed_out') {
        void queryClient.invalidateQueries({ queryKey: currentUserOptions.queryKey })
      }
      toast.error(m.team_problem({ problem }))
    },
    onSettled: () => {
      if (!isLastChange()) return
      void queryClient.invalidateQueries({ queryKey: teamKey })
      // The lists that show the team: its owner's, and everyone's.
      const path = { username: team.owner.username }
      void queryClient.invalidateQueries({ queryKey: listUserTeamsQueryKey({ path }) })
      void queryClient.invalidateQueries({ queryKey: listTeamsInfiniteQueryKey() })
    },
  })

  return (variables: Variables) => mutateAsync(variables).catch(() => undefined)
}
