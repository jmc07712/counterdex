import type { CredentialsWritable, User } from '@/api'

export const ASH: User = { id: 1, username: 'ash', is_admin: false }
// Someone else, to check what a user sees of another's things.
export const MISTY: User = { id: 2, username: 'misty', is_admin: false }
export const ASH_CREDENTIALS: CredentialsWritable = {
  username: 'ash',
  password: 'pikachu-i-choose-you',
}
