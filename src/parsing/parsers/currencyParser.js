/**
 * CurrencyParser - Parses currency values with support for all negative formats
 *
 * Supports negative formats:
 * - (€1,000) - parentheses
 * - -€1,000 - minus at start
 * - €-1,000 - minus after symbol
 * - €1,000- - minus at end (if not thousand separator)
 * - And more...
 */
const NBSP = '\u00A0';
const RANGE_SEPARATORS = [' - ', ' – '];
const DIGIT = /\d/;

function lastDigitIndex(text) {
  for (let index = text.length - 1; index >= 0; index -= 1) {
    if (DIGIT.test(text[index])) return index;
  }
  return -1;
}

// "9K € - 35K €" -> ["9K €", "35K €"]; null unless both sides hold a digit.
function splitRange(text) {
  for (const separator of RANGE_SEPARATORS) {
    const at = text.indexOf(separator);
    if (at === -1) continue;
    const low = text.slice(0, at);
    const high = text.slice(at + separator.length);
    if (DIGIT.test(low) && DIGIT.test(high)) return [low, high];
  }
  return null;
}

export class CurrencyParser {
  /**
   * Parse currency value
   * @param rawString - Raw currency string
   * @param formatContext - Format context with separators
   * @param languageConfig - Language configuration with multipliers
   * @returns Parsed currency value or null if invalid
   */
  parseCurrency(rawString, formatContext = {}, languageConfig = {}) {
    if (
      !rawString ||
      rawString === '' ||
      rawString === '-' ||
      rawString === 'N/A' ||
      rawString === 'Nieznane' ||
      rawString === 'Nieznany' ||
      rawString === 'Nieznana' ||
      rawString === 'Unknown'
    ) {
      return null;
    }

    // A range may be separated by non-breaking spaces, which the range split does not see.
    let str = rawString.trim().replaceAll(NBSP, ' ');
    let isNegative = false;

    // FM shows a scouted value as a range, "9K € - 35K €"; it counts as its midpoint, as an
    // attribute range counts as its mean.
    const range = splitRange(str);
    if (range) {
      const low = this.parseCurrency(range[0], formatContext, languageConfig);
      const high = this.parseCurrency(range[1], formatContext, languageConfig);
      return low === null || high === null ? null : (low + high) / 2;
    }

    // Handle negative formats
    // 1. Parentheses: (1,000€) -> negative
    if (str.startsWith('(') && str.endsWith(')')) {
      isNegative = true;
      str = str.slice(1, -1);
    }
    // 2. Minus at start: -€1,000
    else if (str.startsWith('-')) {
      isNegative = true;
      str = str.slice(1);
    }
    // 3. Minus at end: €1,000- (but only if not thousand separator!)
    else if (str.endsWith('-') && formatContext.thousandSeparator !== '-') {
      isNegative = true;
      str = str.slice(0, -1);
    }
    // 4. Minus after currency symbol: €-1,000
    else {
      // Check if it's a range (digit followed by space-hyphen-space)
      if (/\d\s*[-–\u2014]\s*\d/.test(str)) {
        isNegative = false;
      } else {
        const minusAfterSymbol = /[€$£¥]\s*-\s*(\d)/.exec(str);
        if (minusAfterSymbol) {
          isNegative = true;
          str = str.replace(/[€$£¥]\s*-\s*/, '');
        }
      }
    }

    // Remove non-breaking spaces (critical for Polish files)
    str = str.replaceAll('\u00A0', ' ').replaceAll(/\s+/g, '');

    // Remove currency symbols so that a multiplier suffix such as "1,5M zł" stays at the end
    str = str.replaceAll(/[€$£¥]|zł/g, '');

    // Unit of the export language right after the last digit ("1.5K", "1.6 tys.", "1.3万/年").
    // Case matters: Spanish "m" is a thousand and "M" a million. A word that only ends with the
    // same letter (Turkish "yıllık", yearly) is not a unit. Longer units are tried first.
    const multipliers = Object.entries(languageConfig.multipliers || {}).toSorted(
      ([left], [right]) => right.length - left.length
    );
    const afterDigits = lastDigitIndex(str) + 1;
    const unit = multipliers.find(([key]) => str.startsWith(key, afterDigits));
    const multiplier = unit ? unit[1] : 1;
    str = str.slice(0, afterDigits);

    // Remove thousand separators first, so a dot that groups thousands cannot swallow the decimal
    // comma after it has become a dot ("1.234,5" -> "1234,5" -> "1234.5")
    const thousandSep = formatContext.thousandSeparator;
    if (thousandSep) {
      str = str.replaceAll(thousandSep, '');
    }

    // Normalize decimal separator
    const decimalSep = formatContext.decimalSeparator || '.';
    if (decimalSep === ',') {
      str = str.replace(',', '.');
    }

    // Remove any remaining non-numeric characters except decimal point
    str = str.replaceAll(/[^\d.]/g, '');

    const num = parseFloat(str);

    if (isNaN(num)) {
      return null;
    }

    const result = num * multiplier;
    return isNegative ? -result : result;
  }
}
