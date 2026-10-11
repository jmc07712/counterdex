import type { Message } from '@/lib/messages'
import { m } from '@/paraglide/messages.js'

import type { CredentialsProblem } from './credentials-error'

const PROBLEMS: Record<CredentialsProblem, Message> = {
  'wrong-credentials': m.auth_problem_wrong_credentials,
  'username-taken': m.auth_problem_username_taken,
  invalid: m.auth_problem_invalid,
  failed: m.auth_problem_failed,
}

export function problemMessage(problem: CredentialsProblem) {
  return PROBLEMS[problem]()
}
