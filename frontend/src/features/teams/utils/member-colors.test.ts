import { describe, expect, it } from 'vitest'

import { TYPE_STYLES } from '@/components/pokemon/pokemon-types'
import { asMember, catalog } from '@/test/teams'

import { memberColors } from './member-colors'

describe('memberColors', () => {
  it('is its main type’s colors', () => {
    expect(memberColors(asMember(catalog.gengar, 0))).toEqual(TYPE_STYLES.ghost)
  })

  it('is null once it’s no longer in the Pokédex', () => {
    const removed = { ...asMember(catalog.gengar, 0), removed_at: '2026-10-11T09:00:00Z' }

    expect(memberColors(removed)).toBeNull()
  })
})
