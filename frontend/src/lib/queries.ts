/**
 * What `request` answered with, or null if it answered `status`, as the API does for nothing to
 * show, such as 401 for nobody signed in. Any other failure throws, so the query fails rather than
 * caching null.
 */
export async function dataOrNull<T>(
  request: Promise<{ data?: T; request?: Request; response?: Response }>,
  status: number,
): Promise<T | null> {
  const { data, request: sent, response } = await request
  if (response?.status === status) return null
  if (data === undefined) {
    throw new Error(`${sent?.method} ${sent?.url} failed: ${response?.status}`)
  }
  return data
}
