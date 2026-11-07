/**
 * StatisticParser - Parses statistic values (float, can be negative)
 */
export class StatisticParser {
  /**
   * Parse statistic value
   * @param value - Raw value string
   * @param formatContext - Format context with decimal separator
   * @returns Parsed float value or null if invalid
   */
  parse(value, formatContext = {}) {
    if (!value || value === '' || value === '-' || value === 'N/A') {
      return null;
    }

    let str = String(value).trim();

    // Handle negative values
    let isNegative = false;
    if (str.startsWith('-')) {
      isNegative = true;
      str = str.slice(1);
    } else if (str.startsWith('(') && str.endsWith(')')) {
      isNegative = true;
      str = str.slice(1, -1);
    }

    // Normalize decimal separator
    const decimalSep = formatContext.decimalSeparator || '.';
    if (decimalSep === ',') {
      str = str.replace(',', '.');
    }

    // Remove thousand separators
    const thousandSep = formatContext.thousandSeparator;
    if (thousandSep) {
      str = str.replaceAll(thousandSep, '');
    }

    // Remove non-breaking spaces
    str = str.replaceAll('\u00A0', ' ').replaceAll(/\s+/g, '');

    const num = parseFloat(str);

    if (isNaN(num)) {
      return null;
    }

    return isNegative ? -num : num;
  }
}
