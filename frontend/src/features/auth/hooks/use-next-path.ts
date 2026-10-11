import { useSearchParams } from 'react-router'

/** Where to go after signing in: the URL's ?next=, if it's a page of this app. */
export function useNextPath(): string | undefined {
  const [params] = useSearchParams()
  const next = params.get('next')
  // Parsed as the browser would, so tabs, newlines and backslashes in it can't make it another
  // site's address.
  const url = next === null ? null : URL.parse(next, window.location.origin)
  return url?.origin === window.location.origin
    ? url.pathname + url.search + url.hash
    : undefined
}
