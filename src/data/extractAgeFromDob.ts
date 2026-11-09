/**
 * FM appends the age to a date of birth in a closing parenthesis, worded per export language
 * (`(31 years old)`, `(18 l.)`, `(21세)`, full-width `（21歳）` in Japanese). The age is the number
 * that opens that parenthesis, whatever words follow it.
 */
const OPENING = ['(', '（'] as const;
const CLOSING = new Set([')', '）']);
// At most three digits: a year such as "(2024)" is not an age.
const LEADING_AGE = /^\s*(\d{1,3})(?!\d)/;

/**
 * Read the age from an FM date-of-birth cell, e.g. `16.9.1992 (31 years old)`.
 * @param rawValue - Raw DoB cell
 * @returns Age in years, or null when the cell does not end with an age in parentheses
 */
export function extractAgeFromDob(rawValue: unknown): null | number {
  if (typeof rawValue !== 'string') return null;
  const text = rawValue.trim();
  if (!CLOSING.has(text.at(-1) ?? '')) return null;
  const opening = Math.max(...OPENING.map((bracket) => text.lastIndexOf(bracket)));
  if (opening < 0) return null;
  const digits = LEADING_AGE.exec(text.slice(opening + 1, -1))?.[1];
  return digits === undefined ? null : Number.parseInt(digits, 10);
}
