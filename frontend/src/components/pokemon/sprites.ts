// PokéAPI's sprites, from jsDelivr's CDN, where the API serves Pokémon sprites from too.
const SPRITES_URL = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites'

export function pokemonSpriteUrl(pokemonId: number) {
  return `${SPRITES_URL}/pokemon/${pokemonId}.png`
}

/** An item's sprite, such as a Thunder Stone's. Newer items have none. */
export function itemSpriteUrl(item: string) {
  return `${SPRITES_URL}/items/${item}.png`
}
