import { describe, expect, it } from 'vitest'

import { Rating } from '@/api'
import { makeChallenger, makeMatchup } from '@/test/matchups'
import { catalog } from '@/test/teams'

import { bestAnswer, coverage, pickReason } from './matchup-summary'

const { charizard, pikachu, gengar, lapras, snorlax, vaporeon } = catalog
const { GOOD, EVEN, BAD } = Rating

// Their team, in battle order.
const THEIRS = [charizard, pikachu, gengar]

describe('pickReason', () => {
  it.each<[string, Rating[], string]>([
    ['one', [GOOD, BAD, EVEN], 'Strong against Charizard'],
    ['two', [GOOD, EVEN, GOOD], 'Strong against Charizard and Gengar'],
    ['three', [GOOD, GOOD, GOOD], 'Strong against Charizard, Pikachu and Gengar'],
  ])('names the %s of theirs it’s rated good against, in their order', (_, ratings, reason) => {
    const pick = makeChallenger(lapras, THEIRS, ratings)

    expect(pickReason(pick.matchups, THEIRS)).toBe(reason)
  })

  it('names those it holds its own against, if it’s good against none', () => {
    const pick = makeChallenger(lapras, THEIRS, [BAD, EVEN, EVEN])

    expect(pickReason(pick.matchups, THEIRS)).toBe('Holds its own against Pikachu and Gengar')
  })

  it('names those it struggles against, if it’s bad against all of them', () => {
    const pick = makeChallenger(lapras, THEIRS, [BAD, BAD, BAD])

    expect(pickReason(pick.matchups, THEIRS)).toBe(
      'Struggles against Charizard, Pikachu and Gengar',
    )
  })

  it('is null without matchups', () => {
    expect(pickReason([], THEIRS)).toBeNull()
  })
})

describe('coverage', () => {
  it('says when each of theirs has a pick rated good against it', () => {
    const picks = [
      makeChallenger(lapras, THEIRS, [GOOD, BAD, EVEN]),
      makeChallenger(snorlax, THEIRS, [EVEN, GOOD, GOOD]),
    ]

    expect(coverage(picks, THEIRS)).toBe('Every Pokémon on their team has a good answer')
  })

  it('names those of theirs that no pick is rated good against, in their order', () => {
    const picks = [
      makeChallenger(lapras, THEIRS, [EVEN, GOOD, BAD]),
      makeChallenger(snorlax, THEIRS, [BAD, EVEN, EVEN]),
    ]

    expect(coverage(picks, THEIRS)).toBe('Nothing here clearly beats Charizard and Gengar')
  })
})

describe('bestAnswer', () => {
  it('is the pick with the best score against one of theirs, and its matchup', () => {
    const best = makeMatchup({ opponent_id: pikachu.id, score: 1.5, rating: GOOD })
    const picks = [
      makeChallenger(lapras, THEIRS, [GOOD, GOOD, GOOD]),
      { pokemon: snorlax, matchups: [best] },
    ]

    expect(bestAnswer(picks, pikachu.id)).toEqual({ pokemon: snorlax, matchup: best })
  })

  it('is the first in battle order of picks with the same best score', () => {
    const picks = [
      makeChallenger(vaporeon, THEIRS, [EVEN, EVEN, EVEN]),
      makeChallenger(lapras, THEIRS, [GOOD, BAD, EVEN]),
      makeChallenger(snorlax, THEIRS, [GOOD, BAD, EVEN]),
    ]

    expect(bestAnswer(picks, charizard.id)?.pokemon).toBe(lapras)
  })

  it('is undefined when no pick has a matchup against it', () => {
    expect(bestAnswer([], charizard.id)).toBeUndefined()
  })
})
