import type { FormEvent } from 'react'
import { Link } from 'react-router'

import { FieldError, FieldGroup } from '@/components/ui/field'
import { paths } from '@/config/paths'
import { m } from '@/paraglide/messages.js'

import { useNextPath } from '../hooks/use-next-path'
import { useSignIn } from '../hooks/use-sign-in'
import { PASSWORD, USERNAME } from '../utils/credential-rules'
import { credentialsProblem } from '../utils/credentials-error'
import { problemMessage } from '../utils/problem-message'
import { readCredentials } from '../utils/read-credentials'
import { AuthCard } from './auth-card'
import { PasswordField, UsernameField } from './credential-fields'
import { SubmitButton } from './submit-button'

export function SignInForm() {
  const next = useNextPath()
  const signIn = useSignIn()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!signIn.isPending) signIn.mutate(readCredentials(event.currentTarget))
  }

  return (
    <AuthCard
      title={m.auth_sign_in_title()}
      description={m.auth_sign_in_description()}
      busy={signIn.isPending}
      footer={
        <>
          {m.auth_sign_in_switch_prompt()}{' '}
          <Link
            to={paths.signUp.getHref(next)}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {m.auth_go_to_sign_up()}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <UsernameField maxLength={USERNAME.maxLength} />
          <PasswordField autoComplete="current-password" maxLength={PASSWORD.maxLength} />
          {signIn.error && (
            <FieldError>{problemMessage(credentialsProblem(signIn.error))}</FieldError>
          )}
          <SubmitButton pending={signIn.isPending}>
            {signIn.isPending ? m.auth_sign_in_submitting() : m.auth_sign_in_submit()}
          </SubmitButton>
        </FieldGroup>
      </form>
    </AuthCard>
  )
}
