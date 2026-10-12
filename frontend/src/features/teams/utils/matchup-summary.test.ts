import { describe, expect, it } from 'vitest'

import { PokemonType, Rating } from '@/api'
import { makeChallenger, makeMatchup } from '@/test/matchups'
import { catalog } from '@/test/teams'

import {
  bestAnswer,
  coverage,
  pickReason,
  threatReason,
  threatsSummary,
  threatWithoutWins,
  weakSpotsLine,
} from './matchup-summary'

const { charizard, pikachu, gengar, lapras, snorlax, dragonite, vaporeon } = catalog
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

describe('threatReason', () => {
  it('names the members a threat is rated good against, in battle order', () => {
    const threat = makeChallenger(dragonite, THEIRS, [GOOD, EVEN, GOOD])

    expect(threatReason(threat.matchups, THEIRS)).toBe('Beats Charizard and Gengar')
  })

  it('names those it holds its own against, if it beats none', () => {
    const threat = makeChallenger(dragonite, THEIRS, [EVEN, BAD, EVEN])

    expect(threatReason(threat.matchups, THEIRS)).toBe(
      'Holds its own against Charizard and Gengar',
    )
  })

  it('is null without matchups', () => {
    expect(threatReason([], THEIRS)).toBeNull()
  })
})

describe('threatWithoutWins', () => {
  it.each<[string, Rating[], string]>([
    ['even with all', [EVEN, EVEN, EVEN], 'Even with all of yours'],
    ['even with one', [BAD, EVEN, BAD], 'Even with one of yours, beaten by the rest'],
    ['even with two', [EVEN, BAD, EVEN], 'Even with 2 of yours, beaten by the rest'],
    ['beaten by all', [BAD, BAD, BAD], 'Beaten by all of yours'],
  ])('says when a threat is %s of the team', (_, ratings, line) => {
    const threat = makeChallenger(dragonite, THEIRS, ratings)

    expect(threatWithoutWins(threat.matchups)).toBe(line)
  })
})

describe('weakSpotsLine', () => {
  it('names the weak spots, in the order given', () => {
    expect(weakSpotsLine({ exposed: [gengar, charizard], unnamed: 0, commonType: null })).toBe(
      'Weak spots: Gengar and Charizard.',
    )
  })

  it('says which type most threats hit with, if one does', () => {
    expect(weakSpotsLine({ exposed: [pikachu], unnamed: 0, commonType: PokemonType.GROUND })).toBe(
      'Weak spots: Pikachu. Most of them hit with Ground.',
    )
  })

  it('says how many more weak spots there are than it names', () => {
    expect(
      weakSpotsLine({ exposed: [pikachu, gengar, charizard], unnamed: 2, commonType: null }),
    ).toBe('Weak spots: Pikachu, Gengar, Charizard and 2 more.')
  })

  it('says plainly when no member is beaten by half of the threats', () => {
    expect(weakSpotsLine({ exposed: [], unnamed: 0, commonType: null })).toBe(
      'No Pokémon of yours is beaten by half of them.',
    )
  })
})

describe('threatsSummary', () => {
  it('says how many threats there are, and what the biggest beats', () => {
    const threats = [
      makeChallenger(dragonite, THEIRS, [GOOD, EVEN, GOOD]),
      makeChallenger(lapras, THEIRS, [GOOD, BAD, BAD]),
    ]

    expect(threatsSummary(threats, THEIRS)).toBe(
      '2 threats, the biggest Dragonite. Beats Charizard and Gengar.',
    )
  })

  it('says when there’s one threat', () => {
    const threats = [makeChallenger(dragonite, THEIRS, [EVEN, EVEN, EVEN])]

    expect(threatsSummary(threats, THEIRS)).toBe(
      '1 threat, Dragonite. Holds its own against Charizard, Pikachu and Gengar.',
    )
  })

  it('is null without threats', () => {
    expect(threatsSummary([], THEIRS)).toBeNull()
  })

  it('is null if the biggest has no matchups', () => {
    expect(threatsSummary([{ pokemon: dragonite, matchups: [] }], THEIRS)).toBeNull()
  })
})

describe('coverage', () => {
  it('says when each of theirs has a pick rated good against it', () => {
    const picks = [
      makeChallenger(lapras, THEIRS, [GOOD, BAD, EVEN]),
      makeChallenger(snorlax, THEIRS, [EVEN, GOOD, GOOD]),
    ]

    expect(coverage(picks, THEIRS)).toBe('At least one pick beats each Pokémon on their team')
  })

  it('names those of theirs that no pick is rated good against, in their order', () => {
    const picks = [
      makeChallenger(lapras, THEIRS, [EVEN, GOOD, BAD]),
      makeChallenger(snorlax, THEIRS, [BAD, EVEN, EVEN]),
    ]

    expect(coverage(picks, THEIRS)).toBe('No pick clearly beats Charizard and Gengar')
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
