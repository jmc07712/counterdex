import { useLocation, useNavigate, useSearchParams } from 'react-router'

const PARAM = 'pokemon'
// Marks the history entry the Pokédex added by opening a Pokémon, so closing can go back to it.
const OPENED_FROM_POKEDEX = 'opened-from-pokedex'

/**
 * The Pokémon whose details are open, kept in the URL (?pokemon=6) so they can be shared.
 * Opening one adds a history entry, so Back closes the details, as it closes a sheet in a phone
 * app; closing details opened from a shared link just takes the Pokémon out of the URL.
 */
export function useSelectedPokemon() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const id = Number(params.get(PARAM))
  const selected = Number.isInteger(id) && id > 0 ? id : null

  function withPokemon(pokemonId: number | null) {
    const next = new URLSearchParams(params)
    if (pokemonId === null) next.delete(PARAM)
    else next.set(PARAM, String(pokemonId))
    return next
  }

  return {
    selected,
    open: (pokemonId: number) => setParams(withPokemon(pokemonId), { state: OPENED_FROM_POKEDEX }),
    // Another Pokémon in place of the open one, such as one of its forms.
    show: (pokemonId: number) =>
      setParams(withPokemon(pokemonId), { replace: true, state: location.state }),
    close: () => {
      if (location.state === OPENED_FROM_POKEDEX) void navigate(-1)
      else setParams(withPokemon(null), { replace: true })
    },
  }
}
