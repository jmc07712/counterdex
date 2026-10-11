"""Turn PokéAPI responses into the Pokémon, species and type chart the app stores."""

import hashlib
import json
from collections.abc import Iterable, Iterator

from pydantic import ValidationError

from app.pokemon.constants import DOUBLE_DAMAGE, HALF_DAMAGE, NO_DAMAGE, NORMAL_DAMAGE
from app.pokemon.enums import PokemonType
from app.pokemon.schemas import Pokemon
from app.sync.constants import GENUS_LANGUAGE, POKEAPI_STAT_NAMES
from app.sync.pokeapi import (
    ChainLink,
    DamageRelations,
    PokeApiEvolutionChain,
    PokeApiPokemon,
    PokeApiSpecies,
    PokeApiType,
)
from app.sync.types import SpeciesRecord, TypeMatchupRecord


def normalize(raw: PokeApiPokemon) -> Pokemon:
    """Raises ValueError, with a one-line reason, for data our table would refuse."""
    base_stats = {entry.stat.name: entry.base_stat for entry in raw.stats}
    try:
        return Pokemon.model_validate(
            {
                "id": raw.id,
                "name": raw.name,
                "types": [slot.type.name for slot in sorted(raw.types, key=lambda slot: slot.slot)],
                # A stat PokéAPI left out is left out here too, and reported as missing.
                "stats": {
                    ours: base_stats[theirs]
                    for ours, theirs in POKEAPI_STAT_NAMES.items()
                    if theirs in base_stats
                },
                "sprite_url": raw.sprites.front_default,
                "is_default": raw.is_default,
            }
        )
    except ValidationError as error:
        # One line per Pokémon in the sync's log, e.g. "stats.speed: Field required".
        reasons = (
            f"{'.'.join(map(str, problem['loc']))}: {problem['msg']}"
            for problem in error.errors(include_url=False)
        )
        raise ValueError("; ".join(reasons)) from error


def content_hash(pokemon: Pokemon) -> str:
    """SHA-256 of a Pokémon's tracked fields; equal data always gives an equal hash."""
    # The table's flat columns with sorted keys and fixed separators: identical data gives
    # identical bytes, the same bytes the hashes already stored were computed from.
    payload = json.dumps(pokemon.to_columns(), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode()).hexdigest()


def normalize_species(
    species: Iterable[PokeApiSpecies], chains: Iterable[PokeApiEvolutionChain]
) -> list[SpeciesRecord]:
    """The species of every evolution family that was fetched whole, ready to store.

    A family is stored whole or not at all, so a species never evolves from one that isn't
    stored. The species of a family left out keep what was stored before.
    """
    fetched = {each.id: each for each in species}
    # Keyed by id, so a species PokéAPI puts in two chains is still stored once.
    records: dict[int, SpeciesRecord] = {}
    for chain in chains:
        family = list(_family(chain.chain, evolves_from=None))
        if all(link.species.id in fetched for link, _ in family):
            records.update(
                (link.species.id, _species_record(fetched[link.species.id], chain.id, link, parent))
                for link, parent in family
            )
    return list(records.values())


def _family(link: ChainLink, evolves_from: int | None) -> Iterator[tuple[ChainLink, int | None]]:
    """Every species in a chain, from `link` down, with the id of the species it evolves from."""
    yield link, evolves_from
    for evolution in link.evolves_to:
        yield from _family(evolution, link.species.id)


def _species_record(
    species: PokeApiSpecies, chain_id: int, link: ChainLink, evolves_from: int | None
) -> SpeciesRecord:
    # PokéAPI lists older games' ways to evolve too, and marks the latest ones as defaults.
    latest = [detail for detail in link.evolution_details if detail.is_default]
    return SpeciesRecord(
        id=species.id,
        name=species.name,
        genus=next(
            (each.genus for each in species.genera if each.language.name == GENUS_LANGUAGE), None
        ),
        is_legendary=species.is_legendary,
        is_mythical=species.is_mythical,
        evolution_chain_id=chain_id,
        evolves_from_species_id=evolves_from,
        evolution_methods=tuple(
            dict.fromkeys(detail.method for detail in latest or link.evolution_details)
        ),
        pokemon_ids=tuple(variety.pokemon.id for variety in species.varieties),
    )


def normalize_type_chart(types: Iterable[PokeApiType]) -> list[TypeMatchupRecord]:
    """How much damage a move of each type does to a Pokémon of each type, for every pair of
    the types the app knows: the type chart, ready to store.

    Empty unless every one of those types was fetched, so the chart is stored whole or not at
    all. Types the app doesn't have, such as PokéAPI's stellar, are ignored.
    """
    fetched = {
        PokemonType(each.name): each.damage_relations for each in types if each.name in PokemonType
    }
    if fetched.keys() != set(PokemonType):
        return []
    return [
        TypeMatchupRecord(attacking, defending, _multiplier(fetched[attacking], defending))
        for attacking in PokemonType
        for defending in PokemonType
    ]


def _multiplier(relations: DamageRelations, defending: PokemonType) -> float:
    """How much of a move's damage a Pokémon of the defending type takes, by the move type's
    damage relations.
    """
    if any(each.name == defending for each in relations.no_damage_to):
        return NO_DAMAGE
    if any(each.name == defending for each in relations.half_damage_to):
        return HALF_DAMAGE
    if any(each.name == defending for each in relations.double_damage_to):
        return DOUBLE_DAMAGE
    return NORMAL_DAMAGE
