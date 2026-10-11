import type { FormEvent } from 'react'
import { Link } from 'react-router'

import { FieldError, FieldGroup } from '@/components/ui/field'
import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

import { useNextPath } from '../hooks/use-next-path'
import { useSignUp } from '../hooks/use-sign-up'
import { PASSWORD, USERNAME } from '../utils/credential-rules'
import { credentialsProblem } from '../utils/credentials-error'
import { problemMessage } from '../utils/problem-message'
import { readCredentials } from '../utils/read-credentials'
import { AuthCard } from './auth-card'
import { PasswordField, UsernameField } from './credential-fields'
import { SubmitButton } from './submit-button'

export function SignUpForm() {
  const next = useNextPath()
  const signUp = useSignUp()
  const problem = signUp.error ? credentialsProblem(signUp.error) : null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!signUp.isPending) signUp.mutate(readCredentials(event.currentTarget))
  }

  return (
    <AuthCard
      title={m.auth_sign_up_title()}
      description={m.auth_sign_up_description()}
      busy={signUp.isPending}
      footer={
        <>
          {m.auth_sign_up_switch_prompt()}{' '}
          <Link
            to={paths.signIn.getHref(next)}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {m.auth_go_to_sign_in()}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <UsernameField
            {...USERNAME}
            hint={m.auth_sign_up_username_hint({
              min: USERNAME.minLength,
              max: USERNAME.maxLength,
            })}
            error={problem === 'username-taken' ? problemMessage(problem) : undefined}
            // A changed username may not be taken.
            onChange={() => problem === 'username-taken' && signUp.reset()}
          />
          <PasswordField
            {...PASSWORD}
            autoComplete="new-password"
            hint={m.auth_sign_up_password_hint({ min: PASSWORD.minLength })}
          />
          {problem && problem !== 'username-taken' && (
            <FieldError>{problemMessage(problem)}</FieldError>
          )}
          <SubmitButton pending={signUp.isPending}>
            {signUp.isPending ? m.auth_sign_up_submitting() : m.auth_sign_up_submit()}
          </SubmitButton>
        </FieldGroup>
      </form>
    </AuthCard>
  )
}
