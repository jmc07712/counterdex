import { within } from '@testing-library/react'

/** The terms in `container`'s description lists, each beside its definition, as text. */
export function termsAndDefinitions(container: HTMLElement) {
  const definitions = within(container).getAllByRole('definition')
  return within(container)
    .getAllByRole('term')
    .map((term, index) => [term.textContent, definitions[index].textContent])
}
