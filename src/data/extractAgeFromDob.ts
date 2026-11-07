/**
 * Age suffixes FM appends to a date of birth, per export language.
 * Covered: Polish `(18 l.)`, English `(31 years old)`. The language configs in
 * `public/config/languages/` carry no age-suffix pattern, and no export in
 * another language was available to verify its wording.
 */
const DOB_AGE_PATTERN = /\((\d{1,3}) ?(?:l\.|years? old)\)/;

/**
 * Read the age from an FM date-of-birth cell, e.g. `16.9.1992 (31 years old)`.
 * @param rawValue - Raw DoB cell
 * @returns Age in years, or null when no known suffix is present
 */
export function extractAgeFromDob(rawValue: unknown): null | number {
  if (typeof rawValue !== 'string') return null;
  const match = DOB_AGE_PATTERN.exec(rawValue);
  return match ? parseInt(match[1], 10) : null;
}
