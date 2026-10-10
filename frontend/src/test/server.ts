import { setupServer } from 'msw/node'

// Answers the app's real fetch requests in tests. Each test adds the handlers it needs, and any
// request without one fails the test, so tests never reach a real server.
export const server = setupServer()
