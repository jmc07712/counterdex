import pytest
from sqlalchemy.orm import Session

from app.counter.queries import candidates, profiles, type_chart
from app.counter.types import Profile
from app.pokemon import models
from app.pokemon.enums import PokemonType
from tests.support.counter import TYPE_CHART, add_real_pokemon, add_type_chart
from tests.support.pokemon import make_pokemon, remove_pokemon

MACHAMP, MEGA_MACHAMP, MEWTWO, MEW = 68, 10200, 150, 151


def candidate_ids(session: Session, *, forms: bool = False, legendaries: bool = False) -> list[int]:
    return [
        candidate.profile.id
        for candidate in candidates(session, forms=forms, legendaries=legendaries)
    ]


@pytest.fixture
def pool(db_session: Session) -> None:
    """Machamp, Mega Machamp (an alternate form of Machamp's species), Mewtwo (legendary) and
    Mew (mythical).
    """
    add_real_pokemon(db_session, MACHAMP, MEWTWO, MEW)
    db_session.add(
        make_pokemon(id=MEGA_MACHAMP, name="machamp-mega", types=["fighting"], is_default=False)
    )
    db_session.flush()
    db_session.add(models.SpeciesVariety(pokemon_id=MEGA_MACHAMP, species_id=MACHAMP))
    db_session.flush()


@pytest.mark.usefixtures("pool")
def test_chooses_from_default_forms_that_are_neither_legendary_nor_mythical(
    db_session: Session,
) -> None:
    assert candidate_ids(db_session) == [MACHAMP]


@pytest.mark.usefixtures("pool")
def test_chooses_from_alternate_forms_when_asked(db_session: Session) -> None:
    assert candidate_ids(db_session, forms=True) == [MACHAMP, MEGA_MACHAMP]


@pytest.mark.usefixtures("pool")
def test_chooses_from_legendary_and_mythical_pokemon_when_asked(db_session: Session) -> None:
    assert candidate_ids(db_session, legendaries=True) == [MACHAMP, MEWTWO, MEW]


@pytest.mark.usefixtures("pool")
def test_leaves_out_pokemon_pokeapi_no_longer_lists(db_session: Session) -> None:
    remove_pokemon(db_session, MACHAMP)

    assert candidate_ids(db_session, forms=True, legendaries=True) == [
        MEWTWO,
        MEW,
        MEGA_MACHAMP,
    ]


@pytest.mark.usefixtures("pool")
def test_leaves_out_pokemon_whose_species_is_not_stored(db_session: Session) -> None:
    db_session.add(make_pokemon(id=10300, name="new-fighter", types=["fighting"]))
    db_session.flush()

    assert 10300 not in candidate_ids(db_session, forms=True, legendaries=True)


@pytest.mark.usefixtures("pool")
def test_gives_each_candidate_its_family_and_what_scoring_looks_at(db_session: Session) -> None:
    machamp, mega = (
        each
        for each in candidates(db_session, forms=True, legendaries=False)
        if each.profile.id in {MACHAMP, MEGA_MACHAMP}
    )

    # Machamp's evolution family is PokéAPI's chain 28, and Mega Machamp is in its species.
    assert {mega.family_id, machamp.family_id} == {28}
    assert machamp.profile == Profile(
        id=MACHAMP, types=(PokemonType.FIGHTING,), stat_total=505, speed=55
    )


@pytest.mark.usefixtures("pool")
def test_reads_a_teams_pokemon_listed_or_not(db_session: Session) -> None:
    remove_pokemon(db_session, MACHAMP)

    found = profiles(db_session, [MEW, MACHAMP, 99999])

    assert sorted(found) == [MACHAMP, MEW]
    assert found[MEW].stat_total == 600


def test_reads_the_stored_type_chart(db_session: Session) -> None:
    assert type_chart(db_session) == {}

    add_type_chart(db_session)

    assert type_chart(db_session) == TYPE_CHART
