// The API's rules for new accounts. Signing in checks only the most any account can have.
export const USERNAME = { minLength: 3, maxLength: 32, pattern: '[A-Za-z0-9_\\-]+' }
export const PASSWORD = { minLength: 8, maxLength: 128 }
