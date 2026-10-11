import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router'

import type { TeamMember } from '@/api'

const PARAM = 'replace'

/**
 * The member to replace, kept in the URL by its Pokémon's id (?replace=4), as a removed member's
 * Replace link sets it; `cancel` takes it out. An id that isn't a member's is taken out too.
 */
export function useReplacing(members: TeamMember[]) {
  const [params, setParams] = useSearchParams()
  const id = params.get(PARAM)
  const member = members.find((each) => String(each.pokemon.id) === id)
  const stale = id !== null && member === undefined

  const cancel = useCallback(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete(PARAM)
        return next
      },
      { replace: true },
    )
  }, [setParams])

  useEffect(() => {
    if (stale) cancel()
  }, [stale, cancel])

  return { member, cancel }
}
