import { type Team, TeamConflictReason } from '@/api'

// Why a change to a team failed: the API's reason for a conflict, or what its status says:
// signed out, not the team's owner, the team or member not found, or anything else.
type TeamProblem = TeamConflictReason | 'signed_out' | 'not_owner' | 'not_found' | 'failed'

// A 409's body is { detail: <sentence>, reason: <TeamConflictReason> }.
function conflictReason(body: unknown): TeamConflictReason | undefined {
  if (typeof body !== 'object' || body === null || !('reason' in body)) return undefined
  return Object.values(TeamConflictReason).find((reason) => reason === body.reason)
}

function problemOf(response: Response | undefined, body: unknown): TeamProblem {
  const reason = conflictReason(body)
  if (reason) return reason
  switch (response?.status) {
    case 401:
      return 'signed_out'
    case 403:
      return 'not_owner'
    case 404:
      return 'not_found'
    default:
      return 'failed'
  }
}

export class TeamChangeError extends Error {
  readonly problem: TeamProblem

  constructor(response: Response | undefined, body: unknown) {
    const problem = problemOf(response, body)
    super(problem)
    this.problem = problem
  }
}

/** Errors that aren't a TeamChangeError, such as no network, are 'failed'. */
export function teamProblem(error: Error): TeamProblem {
  return error instanceof TeamChangeError ? error.problem : 'failed'
}

type ChangeResult = { data?: Team; error?: unknown; response?: Response }

/** The team the API answered a change with. Throws a TeamChangeError if it refused the change. */
export async function teamAfter(request: Promise<ChangeResult>): Promise<Team> {
  const { data, error, response } = await request
  if (data === undefined) throw new TeamChangeError(response, error)
  return data
}
