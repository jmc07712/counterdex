import { within } from '@testing-library/react'

/**
 * For text queries: a status that reads out what's on screen, such as an empty state's title or a
 * coverage line, holds a copy of it, which this skips to find the one on screen.
 */
export const ON_SCREEN = { ignore: '[role=status]' }

/** The terms in `container`'s description lists, each beside its definition, as text. */
export function termsAndDefinitions(container: HTMLElement) {
  const definitions = within(container).getAllByRole('definition')
  return within(container)
    .getAllByRole('term')
    .map((term, index) => [term.textContent, definitions[index].textContent])
}

/** Each row of `table`, headers too, as its cells' text. */
export function cellsByRow(table: HTMLElement) {
  return within(table)
    .getAllByRole('row')
    .map((row) => Array.from(row.querySelectorAll('th, td'), (cell) => cell.textContent))
}
