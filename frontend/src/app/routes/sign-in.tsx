import { SignInForm } from '@/features/auth/components/sign-in-form'
import { SignedOutOnly } from '@/features/auth/components/signed-out-only'

export function SignInPage() {
  return (
    <SignedOutOnly>
      <SignInForm />
    </SignedOutOnly>
  )
}
