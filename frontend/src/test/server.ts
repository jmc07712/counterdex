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

/**
 * Holds every `method` request to `path`, or those of them `when` picks, until `release` is called,
 * then hands each on to the next handler that matches it, such as a stand-in. `arrived` counts the
 * requests held so far. Call it after that handler, so it comes first.
 */
export function holdRequests(
  method: 'all' | 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  when: (request: Request) => boolean = () => true,
) {
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  let arrived = 0
  server.use(
    // Answering nothing hands the request on to the next handler that matches.
    http[method](path, async ({ request }) => {
      if (!when(request)) return
      arrived += 1
      await released
    }),
  )
  return { release, arrived: () => arrived }
}

/**
 * Answers the next GET request to `path` with an error `status`, then hands later ones on to the
 * next handler that matches, such as a stand-in. Call it after that handler, so it comes first.
 */
export function failOnce(path: string, status: number) {
  server.use(http.get(path, () => refusal(status), { once: true }))
}
