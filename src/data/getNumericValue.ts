import { parseNumber } from './parseNumber';
import { splitRange } from './splitRange';

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

export function getNumericValue(
  val: unknown,
  useAverageForRanges = false,
  isWage = false
): null | number {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return isWage || val < 0 ? Math.max(0, val) : val;
  }

  const s = val.toString().trim();
  if (MISSING_SYMBOLS.has(s)) {
    return isWage ? 0 : null;
  }

  if (
    (s.includes('-') || s.includes('–') || s.includes('\u2014')) &&
    /\d/.test(s) &&
    !s.startsWith('-') &&
    !s.startsWith('–') &&
    !s.startsWith('\u2014')
  ) {
    const rangeMatch = splitRange(s);
    if (rangeMatch) {
      const leftVal = parseNumber(rangeMatch[0].trim());
      const rightVal = parseNumber(rangeMatch[1].trim());
      if (leftVal !== null && rightVal !== null) {
        if (useAverageForRanges) {
          return Math.max(0, (leftVal + rightVal) / 2);
        }
        return null;
      }
    }
  }

  const num = parseNumber(s);
  if (num !== null) {
    return Math.max(0, num);
  }
  return null;
}
