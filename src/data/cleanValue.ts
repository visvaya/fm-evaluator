import { parseNumber } from './parseNumber';

export type CleanedValue = null | number | string;
export type CleanValueFn = (val: unknown, isWage?: boolean) => CleanedValue;
type RangeParts = [left: string, right: string];

const MISSING_SYMBOLS = new Set([
  '',
  '-',
  'brak',
  'N/A',
  'N/D',
  'n/d',
  'N/d',
  'Nieznana',
  'Nieznane',
  'Nieznany',
  'none',
  'Unknown'
]);

const STRENGTH_MAP: Record<string, number> = {
  'Bardzo mocna': 5,
  'Bardzo słaba': 0,
  'Fairly Strong': 3,
  Mocna: 4,
  Przyzwoita: 2,
  Reasonable: 2,
  Słaba: 1,
  Strong: 4,
  'Very Strong': 5,
  'Very Weak': 0,
  Weak: 1,
  'Względnie mocna': 3
};

// 'M' in the class already matches any string containing a lowercase 'm'
// (case-insensitive flag), so literal 'mln'/'mil' alternatives never add
// matching power beyond it - keeping them would be dead disjunctions.
const RANGE_WITH_UNIT_RE = /[€$£KM]|p\/[aw]|tys/i;
const RANGE_DASH_RE = /[-–\u2014]/;

function toRawString(val: unknown): string {
  // val is genuinely `unknown` here - every raw FM export cell reaching
  // this function is expected to already be a string or number, so a
  // plain String() coercion is intentional, not an accidental object
  // stringification.
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(val).trim();
}

/** Splits "left - right" on the first dash without regex backtracking risk. */
function splitRangeParts(s: string): null | RangeParts {
  const dashIndex = s.search(RANGE_DASH_RE);
  if (dashIndex <= 0) return null;

  const left = s.slice(0, dashIndex).trim();
  const right = s.slice(dashIndex + 1).trim();
  return left && right ? [left, right] : null;
}

// Return type is intentionally polymorphic (null | number | string), matching
// CleanedValue - a numeric range collapses to its midpoint, a range with a
// currency/unit marker stays a string for display, anything else bails null.
function resolveRangeValue(s: string): CleanedValue {
  const startsWithDash = RANGE_DASH_RE.test(s[0] ?? '');
  if (startsWithDash || !RANGE_DASH_RE.test(s)) return null;

  const parts = splitRangeParts(s);
  if (!parts) return null;

  const v1 = parseNumber(parts[0]);
  const v2 = parseNumber(parts[1]);
  if (v1 === null || v2 === null) return null;

  return RANGE_WITH_UNIT_RE.test(s) ? s : (v1 + v2) / 2;
}

/**
 * Creates a memoized value-cleaning function backed by the supplied cache Map.
 * The caller owns the cache lifetime (e.g. DataProcessor clears it on mergeData).
 *
 * Converts raw FM export values to numbers or strings:
 * - foot-strength labels → 0-5 integer
 * - numeric ranges without currency → midpoint
 * - numeric ranges with currency/unit → original string (kept for UI display)
 * - plain numbers (K/M/tys/mln aware) → number
 * - unknown strings → string passthrough
 */
export function createCleanValue(cache: Map<string, CleanedValue>): CleanValueFn {
  // Return type is intentionally polymorphic (null | number | string) -
  // this is the documented CleanValueFn contract, not an accident.
  return function cleanValue(val: unknown, isWage = false): CleanedValue {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;

    const s = toRawString(val);

    if (MISSING_SYMBOLS.has(s)) {
      return isWage ? 0 : null;
    }

    if (cache.has(s)) return cache.get(s) ?? null;

    const strengthVal = STRENGTH_MAP[s];
    if (strengthVal !== undefined) {
      cache.set(s, strengthVal);
      return strengthVal;
    }

    const rangeVal = resolveRangeValue(s);
    if (rangeVal !== null) {
      if (typeof rangeVal === 'number') cache.set(s, rangeVal);
      return rangeVal;
    }

    let num = parseNumber(s);
    if (num !== null) {
      if (isWage || s.includes('€') || s.includes('£') || s.includes('$')) {
        num = Math.max(0, num);
      }
      cache.set(s, num);
      return num;
    }

    return s;
  };
}
