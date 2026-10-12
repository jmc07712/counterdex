import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

import type { TeamMember } from '@/api'

import { useRemoveParam } from './use-remove-param'

const PARAM = 'replace'

/**
 * The member to replace, kept in the URL by its Pokémon's id (?replace=4), as a removed member's
 * Replace link sets it; `replaceTo` is such a link that keeps the rest of the URL, and `cancel`
 * takes it out. An id that isn't a member's is taken out too.
 */
export function useReplacing(members: TeamMember[]) {
  const [params] = useSearchParams()
  const id = params.get(PARAM)
  const member = members.find((each) => String(each.pokemon.id) === id)
  const stale = id !== null && member === undefined
  const cancel = useRemoveParam(PARAM)

  useEffect(() => {
    if (stale) cancel()
  }, [stale, cancel])

  function replaceTo(pokemonId: number) {
    const next = new URLSearchParams(params)
    next.set(PARAM, `${pokemonId}`)
    return `?${next}`
  }

  return { member, replaceTo, cancel }
}
