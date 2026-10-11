import { SignUpForm } from '@/features/auth/components/sign-up-form'
import { SignedOutOnly } from '@/features/auth/components/signed-out-only'

export function SignUpPage() {
  return (
    <SignedOutOnly>
      <SignUpForm />
    </SignedOutOnly>
  )
}
