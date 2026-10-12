import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { Team } from '@/api'
import { listUserTeamsOptions } from '@/api/@tanstack/react-query.gen'
import { currentUserOptions } from '@/lib/auth'

import { teamProblem, toastTeamProblem } from '../utils/team-change-error'
import { teamQueryOptions } from './use-team'
import { invalidateTeamLists } from './use-user-teams'

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
 * Makes one kind of change to a team, showing it at once, in the team and in its owner's list of
 * teams.
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
  const listKey = listUserTeamsOptions({ path: { username: team.owner.username } }).queryKey
  const mutationKey = ['change-team', team.id]
  const isLastChange = () => queryClient.isMutating({ mutationKey }) === 1

  const { mutateAsync } = useMutation({
    mutationKey,
    scope: teamChangeScope(team.id),
    mutationFn: send,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: teamKey })
      await queryClient.cancelQueries({ queryKey: listKey })
      const previous = queryClient.getQueryData(teamKey)
      const previousListed = queryClient.getQueryData(listKey)?.find((each) => each.id === team.id)
      queryClient.setQueryData(teamKey, (shown) => shown && apply(shown, variables))
      // Only when the team is in it, as setting a list marks it fresh, even one waiting to be
      // fetched again.
      if (previousListed) {
        queryClient.setQueryData(listKey, (teams) =>
          teams?.map((each) => (each.id === team.id ? apply(each, variables) : each)),
        )
      }
      return { previous, previousListed }
    },
    onError: (error, _variables, snapshot) => {
      if (snapshot && isLastChange()) {
        queryClient.setQueryData(teamKey, snapshot.previous)
        // Only this team, as the list may show changes made to the others since.
        const { previousListed } = snapshot
        if (previousListed) {
          queryClient.setQueryData(listKey, (teams) =>
            teams?.map((each) => (each.id === team.id ? previousListed : each)),
          )
        }
      }
      // Asks again who's signed in, so the page stops offering changes the API won't take.
      if (teamProblem(error) === 'signed_out') {
        void queryClient.invalidateQueries({ queryKey: currentUserOptions.queryKey })
      }
      toastTeamProblem(error)
    },
    onSettled: () => {
      if (!isLastChange()) return
      void queryClient.invalidateQueries({ queryKey: teamKey })
      void invalidateTeamLists(queryClient, team.owner.username)
    },
  })

  return (variables: Variables) => mutateAsync(variables).catch(() => undefined)
}
