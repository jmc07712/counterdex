export type CredentialsProblem = 'wrong-credentials' | 'username-taken' | 'invalid' | 'failed'

const PROBLEM_BY_STATUS: Partial<Record<number, CredentialsProblem>> = {
  401: 'wrong-credentials',
  409: 'username-taken',
  422: 'invalid',
}

export class CredentialsError extends Error {
  readonly problem: CredentialsProblem

  constructor(response: Response | undefined) {
    const problem = (response && PROBLEM_BY_STATUS[response.status]) ?? 'failed'
    super(problem)
    this.problem = problem
  }
}

/** Errors that aren't a CredentialsError, such as no network, are 'failed'. */
export function credentialsProblem(error: Error): CredentialsProblem {
  return error instanceof CredentialsError ? error.problem : 'failed'
}
