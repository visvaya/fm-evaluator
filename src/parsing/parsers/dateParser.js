/**
 * DateParser - Parses date values according to detected format
 *
 * Returns ISO calendar dates (`YYYY-MM-DD` strings), never `Date` objects.
 *
 * Supports formats (any of the separators /, . or - is accepted):
 * - DD/MM/YYYY
 * - MM/DD/YYYY
 * - YYYY/MM/DD
 *
 * A trailing parenthesised suffix, as FM appends to DoB (`16.9.1992 (31 years old)`,
 * `25.1.2006 (18 l.)`), is stripped before matching.
 */

const DATE_SEPARATORS = /[/\-.]/;

/**
 * Remove a trailing `(...)` suffix, e.g. the age FM appends to a date of birth.
 * Implemented without a regex to keep it linear on arbitrary input.
 * @param str - Raw input
 * @returns Input without the suffix, trimmed
 */
export function stripTrailingParenthetical(str) {
  const text = String(str).trim();
  if (!text.endsWith(')')) return text;
  const open = text.lastIndexOf('(');
  if (open <= 0) return text;
  return text.slice(0, open).trim();
}

/**
 * Expand a 2-digit year (< 50 -> 2000s, >= 50 -> 1900s).
 * @param year - Year as written
 * @returns Full year
 */
function expandTwoDigitYear(year) {
  if (year >= 100) return year;
  return year < 50 ? year + 2000 : year + 1900;
}

/**
 * Build an ISO date string after validating the calendar fields.
 * @param year - Full or 2-digit year
 * @param month - 1-based month
 * @param day - Day of month
 * @returns `YYYY-MM-DD` or null if invalid
 */
function toIsoDate(year, month, day) {
  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    return null;
  }

  const fullYear = expandTwoDigitYear(year);

  const date = new Date(Date.UTC(fullYear, month - 1, day));
  if (
    date.getUTCFullYear() !== fullYear ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${String(fullYear).padStart(4, '0')}-${mm}-${dd}`;
}

export class DateParser {
  /**
   * Auto-detect and parse date format
   * @param str - Date string without suffix
   * @returns ISO date string or null
   */
  _autoDetectAndParse(str) {
    const match = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (!match) return null;

    const first = parseInt(match[1], 10);
    const second = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (first <= 12 && second > 12) {
      // MM/DD/YYYY
      return toIsoDate(year, first, second);
    }
    // DD/MM/YYYY, also the default for ambiguous values
    return toIsoDate(year, second, first);
  }

  /**
   * Parse date value
   * @param value - Raw date string
   * @param formatContext - Format context with dateFormat
   * @returns ISO date string (`YYYY-MM-DD`) or null if invalid
   */
  parse(value, formatContext = {}) {
    if (!value || value === '' || value === '-' || value === 'N/A') {
      return null;
    }

    const str = stripTrailingParenthetical(value);
    if (str === '' || str === '-' || str === 'N/A') {
      return null;
    }

    const dateFormat = formatContext.dateFormat || { format: 'DD/MM', separator: '/' };
    const parts = str.split(DATE_SEPARATORS).map((part) => parseInt(part, 10));

    if (parts.length < 3) {
      return null;
    }

    switch (dateFormat.format) {
      case 'DD-MM':
      case 'DD.MM':
      case 'DD/MM': {
        return toIsoDate(parts[2], parts[1], parts[0]);
      }

      case 'MM-DD':
      case 'MM.DD':
      case 'MM/DD': {
        return toIsoDate(parts[2], parts[0], parts[1]);
      }

      case 'YYYY-MM-DD':
      case 'YYYY.MM.DD':
      case 'YYYY/MM/DD': {
        return toIsoDate(parts[0], parts[1], parts[2]);
      }

      default: {
        return this._autoDetectAndParse(str);
      }
    }
  }
}
