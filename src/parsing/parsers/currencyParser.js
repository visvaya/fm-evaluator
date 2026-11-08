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

    let str = rawString.trim();
    let isNegative = false;

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

    // Handle K/M multipliers (thousands/millions)
    const multipliers = languageConfig.multipliers || {};
    let multiplier = 1;

    // Check for multiplier suffix
    const upperStr = str.toUpperCase();
    for (const [key, value] of Object.entries(multipliers)) {
      if (upperStr.endsWith(key.toUpperCase())) {
        multiplier = value;
        str = str.slice(0, -key.length);
        break;
      }
    }

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
