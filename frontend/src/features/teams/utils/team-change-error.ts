import { TeamConflictReason } from '@/api'

/** Why a change to a team failed: a conflict's reason, a team or member gone, or anything else. */
export type TeamProblem = TeamConflictReason | 'not_found' | 'failed'

const REASONS: readonly string[] = Object.values(TeamConflictReason)

function isReason(value: unknown): value is TeamConflictReason {
  return typeof value === 'string' && REASONS.includes(value)
}

export class TeamChangeError extends Error {
  readonly problem: TeamProblem

  constructor(response: Response | undefined, body: unknown) {
    // A 409's body is { detail: <sentence>, reason: <TeamConflictReason> }.
    const reason =
      typeof body === 'object' && body !== null && 'reason' in body ? body.reason : null
    const problem: TeamProblem = isReason(reason)
      ? reason
      : response?.status === 404
        ? 'not_found'
        : 'failed'
    super(problem)
    this.problem = problem
  }
}

/** Errors that aren't a TeamChangeError, such as no network, are 'failed'. */
export function teamProblem(error: Error): TeamProblem {
  return error instanceof TeamChangeError ? error.problem : 'failed'
}
