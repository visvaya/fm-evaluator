/**
 * DistanceParser - Parses distance values with unit normalization
 */
export class DistanceParser {
  /**
   * Detect distance unit from string
   * @param str - Value string
   * @returns Unit (km, m, mi, yd) or null
   */
  _detectUnit(str) {
    const lowerStr = str.toLowerCase();

    if (/\b(km|kilometer|kilometr|kilomètre)\b/i.test(lowerStr)) {
      return 'km';
    }
    if (/\b(m\b|meter|metr|mètre)\b/i.test(lowerStr) && !/\b(km|mi|yd)\b/i.test(lowerStr)) {
      return 'm';
    }
    if (/\b(mi|mile|mila|mille)\b/i.test(lowerStr)) {
      return 'mi';
    }
    if (/\b(yd|yard|jard)\b/i.test(lowerStr)) {
      return 'yd';
    }

    return null;
  }

  /**
   * Parse distance value with unit normalization
   * @param value - Raw distance string
   * @param formatContext - Format context
   * @param normalizationConfig - Normalization configuration
   * @returns Normalized distance value or null
   */
  parse(value, formatContext = {}, normalizationConfig = null) {
    if (!value || value === '' || value === '-' || value === 'N/A') {
      return null;
    }

    let str = String(value).trim();

    // Detect unit
    const unit = this._detectUnit(str);

    // Extract numeric value (aggressive cleaning)
    str = str.replaceAll(/[^\d.,\s-]/g, ''); // Remove all non-numeric except decimal separators and spaces

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

    // Remove spaces
    str = str.replaceAll(/\s+/g, '');

    const num = parseFloat(str);

    if (isNaN(num)) {
      return null;
    }

    // Normalize if config provided
    if (normalizationConfig && unit) {
      const multiplier = normalizationConfig.getDistanceMultiplier(unit);
      return num * multiplier;
    }

    return num;
  }
}
