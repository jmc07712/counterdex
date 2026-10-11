/** The longest search the API takes. */
export const MAX_SEARCH_LENGTH = 50

/**
 * The option `value` names, or undefined if it names none, such as a value from a hand-edited URL
 * or a toggle group that was cleared.
 */
export function parseOption<T extends string>(
  options: readonly T[],
  value: string | null,
): T | undefined {
  return options.find((option) => option === value)
}
