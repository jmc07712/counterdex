import { waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { servePokemon } from '@/test/handlers'
import { renderHookWithProviders } from '@/test/render'

import { usePokemonSuggestions } from './use-pokemon-suggestions'

describe('usePokemonSuggestions', () => {
  it('asks for a few Pokémon whose names match the search', async () => {
    const requests = servePokemon()

    renderHookWithProviders(() => usePokemonSuggestions('char'))

    await waitFor(() => expect(requests).toEqual(['q=char&limit=8']))
  })

  it('keeps the search within the 50 characters the API takes', async () => {
    const requests = servePokemon()

    renderHookWithProviders(() => usePokemonSuggestions('a'.repeat(60)))

    await waitFor(() => expect(requests).toEqual([`q=${'a'.repeat(50)}&limit=8`]))
  })
})
