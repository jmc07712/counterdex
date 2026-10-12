import { http, HttpResponse, type JsonBodyType } from 'msw'
import { setupServer } from 'msw/node'

// Answers the app's real fetch requests in tests. Each test adds the handlers it needs, and any
// request without one fails the test, so tests never reach a real server.
export const server = setupServer()

/**
 * Answers GET requests to `path` with `respond`'s JSON. Returns each request's query string, in
 * the order they came, so tests can check what the app asked for.
 */
export function serve(path: string, respond: (query: URLSearchParams) => JsonBodyType): string[] {
  const requests: string[] = []
  server.use(
    http.get(path, ({ request }) => {
      const query = new URL(request.url).searchParams
      requests.push(query.toString())
      return HttpResponse.json(respond(query))
    }),
  )
  return requests
}

/** The API's answer when it refuses a request with `status`. */
export function refusal(status: number) {
  return HttpResponse.json({ detail: 'Refused.' }, { status })
}
