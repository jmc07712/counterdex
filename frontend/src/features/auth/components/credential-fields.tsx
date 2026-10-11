import { type ComponentProps, useId } from 'react'

import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { m } from '@/paraglide/messages.js'

type FieldProps = ComponentProps<typeof Input> & { hint?: string; error?: string }

export function UsernameField(props: FieldProps) {
  return (
    <TextField
      label={m.auth_username()}
      name="username"
      autoComplete="username"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      {...props}
    />
  )
}

export function PasswordField(props: FieldProps) {
  return <TextField label={m.auth_password()} name="password" type="password" {...props} />
}

function TextField({ label, hint, error, ...props }: FieldProps & { label: string }) {
  const id = useId()
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ')

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        required
        aria-invalid={!!error}
        aria-describedby={describedBy || undefined}
        {...props}
      />
      {hint && <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  )
}
