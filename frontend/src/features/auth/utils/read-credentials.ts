import type { CredentialsWritable } from '@/api'

export function readCredentials(form: HTMLFormElement): CredentialsWritable {
  const data = new FormData(form)
  return {
    // A phone keyboard's suggestion can leave a space after the username.
    username: String(data.get('username')).trim(),
    password: String(data.get('password')),
  }
}
