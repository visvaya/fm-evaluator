/**
 * FormatInspector - Detects data formats independently of language
 * Exports to: window.FormatInspector
 *
 * KEY PRINCIPLE: FormatContext is per-file, not global. Each file in Merge mode
 * has its own FormatContext. This is critical because a user may upload
 * Attributes.html (PL format, commas) and Stats.html (EN format, dots) -
 * each must have its own context.
 *
 * Smart Sampling Strategy:
 * KEY PRINCIPLE: NOT "first 20 rows" (may be all zeros for goalkeepers in xG).
 * Instead use "Scan Until N Valid Values" skipping empty values.
 */
import { stripTrailingParenthetical } from './parsers/dateParser.js';

class FormatInspector {
  constructor() {
    // Check dependencies
    if (window.SchemaRegistry === undefined) {
      throw new TypeError('SchemaRegistry must be loaded before FormatInspector');
    }
  }

  /**
   * Analyze file data and return FormatContext
   * @param fileData - Array of data rows
   * @param columnMap - Map of column index to schema ID
   * @param schemaRegistry - Schema registry instance
   * @param fileId - Unique file identifier
   * @param languageConfig - Language configuration
   * @returns FormatContext object
   */
  analyze(fileData, columnMap, schemaRegistry, fileId, languageConfig = {}) {
    // Smart Sampling: scan until N valid values
    const sample = this.smartSample(fileData, columnMap, schemaRegistry);

    const formatContext = {
      confidence: this.calculateConfidence(sample),
      currencySymbol: this.detectCurrency(sample),
      dateFormat: this.detectDateFormat(sample),
      decimalSeparator: this.detectDecimalSeparator(sample),
      distanceUnits: this.detectDistanceUnits(sample),
      fileId: fileId, // Per-file identifier
      thousandSeparator: this.detectThousandSeparator(sample),
      unknownUnits: this.scanForUnknownUnits(sample, languageConfig),
      wageFrequencies: this.detectWageFrequencies(sample, languageConfig)
    };

    return formatContext;
  }

  /**
   * Calculate confidence score
   * @param sample - Sample data
   * @returns Confidence score (0-1)
   */
  calculateConfidence(sample) {
    if (sample.length === 0) {
      return 0;
    }

    let confidence = 0.5; // Base confidence

    // Increase confidence with more samples
    confidence += Math.min(0.3, sample.length / 30);

    // Increase confidence if we detected clear patterns
    const hasDecimal = sample.some((item) => /[.,]\d{1,2}/.test(String(item.value)));
    if (hasDecimal) confidence += 0.1;

    const hasCurrency = sample.some((item) => /[€$£¥zł]/.test(String(item.value)));
    if (hasCurrency) confidence += 0.1;

    return Math.min(1, confidence);
  }

  /**
   * Detect currency symbol
   * @param sample - Sample data
   * @returns Currency symbol or null
   */
  detectCurrency(sample) {
    const symbols = new Set();

    for (const item of sample) {
      const str = String(item.value);
      const match = str.match(/[€$£¥zł]/);
      if (match) {
        symbols.add(match[0]);
      }
    }

    if (symbols.size === 1) {
      return [...symbols][0];
    }

    return null;
  }

  /**
   * Detect date format
   * @param sample - Sample data (should contain date values)
   * @returns Date format object with format, separator, and confidence
   */
  detectDateFormat(sample) {
    const dateValues = sample
      .map((item) => stripTrailingParenthetical(String(item.value)))
      .filter((v) => /^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}$/.test(v));

    if (dateValues.length === 0) {
      return { confidence: 0.5, format: 'DD/MM', separator: '/' };
    }

    let ddmmCount = 0;
    let mmddCount = 0;
    let ambiguousCount = 0;
    let separator = '/';

    for (const value of dateValues) {
      const parts = value.split(/[/\-.]/);
      if (parts.length >= 3) {
        // Detect separator
        if (value.includes('.')) separator = '.';
        else if (value.includes('-')) separator = '-';
        else separator = '/';

        const first = parseInt(parts[0], 10);
        const second = parseInt(parts[1], 10);

        if (first > 12) {
          ddmmCount++; // Definitely DD/MM
        } else if (second > 12) {
          mmddCount++; // Definitely MM/DD
        } else {
          ambiguousCount++; // Both <= 12, ambiguous
        }
      }
    }

    if (ddmmCount > mmddCount && ddmmCount > ambiguousCount) {
      return { confidence: ddmmCount / dateValues.length, format: 'DD/MM', separator };
    } else if (mmddCount > ddmmCount && mmddCount > ambiguousCount) {
      return { confidence: mmddCount / dateValues.length, format: 'MM/DD', separator };
    } else {
      return { confidence: 0.5, format: 'AMBIGUOUS', separator };
    }
  }

  /**
   * Detect decimal separator
   * @param sample - Sample data
   * @returns Decimal separator ('.' or ',')
   */
  detectDecimalSeparator(sample) {
    let dotCount = 0;
    let commaCount = 0;

    for (const item of sample) {
      const str = String(item.value);
      // Look for patterns like 12.5 or 12,5 (not 1.000 or 1,000 which are thousands)
      if (/^\d+\.\d{1,2}$/.test(str)) {
        dotCount++;
      } else if (/^\d+,\d{1,2}$/.test(str)) {
        commaCount++;
      }
    }

    return commaCount > dotCount ? ',' : '.';
  }

  /**
   * Detect distance units in sample
   * @param sample - Sample data
   * @returns Set of detected units
   */
  detectDistanceUnits(sample) {
    const units = new Set();

    for (const item of sample) {
      const str = String(item.value).toLowerCase();
      if (/\b(km|kilometer|kilometr|kilomètre)\b/i.test(str)) {
        units.add('km');
      }
      if (/\b(m\b|meter|metr|mètre)\b/i.test(str) && !/\b(km|mi|yd)\b/i.test(str)) {
        units.add('m');
      }
      if (/\b(mi|mile|mila|mille)\b/i.test(str)) {
        units.add('mi');
      }
      if (/\b(yd|yard|jard)\b/i.test(str)) {
        units.add('yd');
      }
    }

    return units;
  }

  /**
   * Detect thousand separator
   * @param sample - Sample data
   * @returns Thousand separator or null
   */
  detectThousandSeparator(sample) {
    let dotCount = 0;
    let commaCount = 0;
    let spaceCount = 0;
    let nonBreakingSpaceCount = 0;

    for (const item of sample) {
      const str = String(item.value);
      // Look for patterns like 1.000 or 1,000 or 1 000
      if (/^\d{1,3}\.\d{3}/.test(str)) {
        dotCount++;
      } else if (/^\d{1,3},\d{3}/.test(str)) {
        commaCount++;
      } else if (/^\d{1,3}\s\d{3}/.test(str)) {
        spaceCount++;
      } else if (/^\d{1,3}\u00A0\d{3}/.test(str)) {
        nonBreakingSpaceCount++;
      }
    }

    if (nonBreakingSpaceCount > 0) {
      return '\u00A0'; // Non-breaking space
    }
    if (spaceCount > dotCount && spaceCount > commaCount) {
      return ' ';
    }
    if (commaCount > dotCount) {
      return ',';
    }
    if (dotCount > 0) {
      return '.';
    }

    return null;
  }

  /**
   * Detect wage frequencies in sample
   * @param sample - Sample data
   * @param languageConfig - Language configuration
   * @returns Set of detected frequencies
   */
  detectWageFrequencies(sample, languageConfig) {
    const frequencies = new Set();

    for (const item of sample) {
      const str = String(item.value).toLowerCase();
      if (/\b(p\/w|p\/tyg|tyg\.|weekly|semanal|semaine|woche)\b/i.test(str)) {
        frequencies.add('weekly');
      }
      if (/\b(p\/m|p\/mies|mies\.|monthly|mensual|mensuel|monat)\b/i.test(str)) {
        frequencies.add('monthly');
      }
      if (/\b(p\/a|p\/rok|rok\.|yearly|anual|annuel|jahr)\b/i.test(str)) {
        frequencies.add('yearly');
      }
    }

    return frequencies;
  }

  /**
   * Check if value is empty or zero
   * @param value - Value to check
   * @returns True if empty or zero
   */
  isEmptyOrZero(value) {
    if (!value || value === '-' || value === '' || value === 'N/A') return true;
    const num = parseFloat(
      String(value)
        .replace(',', '.')
        .replaceAll(/[^\d.-]/g, '')
    );
    return isNaN(num) || num === 0;
  }

  /**
   * Check if value is valid attribute (1-20)
   * @param value - Value to check
   * @returns True if valid attribute
   */
  isValidAttributeValue(value) {
    if (!value || value === '' || value === '-') return false;
    const num = parseInt(String(value), 10);
    return !isNaN(num) && num >= 1 && num <= 20;
  }

  /**
   * Check if value is valid currency
   * @param value - Value to check
   * @returns True if valid currency
   */
  isValidCurrencyValue(value) {
    if (!value || value === '' || value === '-') return false;
    const str = String(value);
    // Check for currency symbols or numeric content
    return /[€$£¥zł]/.test(str) || /[\d.,\s-]/.test(str);
  }

  /**
   * Check if value is valid float
   * @param value - Value to check
   * @returns True if valid float
   */
  isValidFloatValue(value) {
    if (!value || value === '' || value === '-') return false;
    const num = parseFloat(
      String(value)
        .replace(',', '.')
        .replaceAll(/[^\d.-]/g, '')
    );
    return !isNaN(num);
  }

  /**
   * Scan for unknown units
   * @param sample - Sample data
   * @param languageConfig - Language configuration
   * @returns Array of unknown unit objects
   */
  scanForUnknownUnits(sample, languageConfig) {
    const knownUnits = new Set();
    const multipliers = languageConfig.multipliers || {};

    // Add known multipliers
    for (const key of Object.keys(multipliers)) {
      knownUnits.add(key.toLowerCase());
    }

    // Add known distance units
    knownUnits.add('km');
    knownUnits.add('m');
    knownUnits.add('mi');
    knownUnits.add('yd');

    // Add known frequency units
    knownUnits.add('p/w');
    knownUnits.add('p/m');
    knownUnits.add('p/a');
    knownUnits.add('weekly');
    knownUnits.add('monthly');
    knownUnits.add('yearly');

    const unknownUnits = new Map();

    for (const item of sample) {
      const str = String(item.value);
      // Extract potential unit tokens (short, < 5 chars, alphanumeric)
      const tokens = str.match(/\b[a-z]{1,4}\b/gi);

      if (tokens) {
        for (const token of tokens) {
          const lowerToken = token.toLowerCase();
          if (!knownUnits.has(lowerToken) && !unknownUnits.has(lowerToken)) {
            unknownUnits.set(lowerToken, {
              count: 1,
              example: str,
              unit: lowerToken
            });
          } else if (unknownUnits.has(lowerToken)) {
            unknownUnits.get(lowerToken).count++;
          }
        }
      }
    }

    return [...unknownUnits.values()];
  }

  /**
   * Smart sampling: scan until N valid values
   * KEY PRINCIPLE: Skip empty values, zeros, and invalid values
   * @param fileData - Array of data rows
   * @param columnMap - Map of column index to schema ID
   * @param schemaRegistry - Schema registry instance
   * @returns Sample array with valid values
   */
  smartSample(fileData, columnMap, schemaRegistry) {
    const sample = [];
    const targetSampleSize = 10;

    for (const row of fileData) {
      if (sample.length >= targetSampleSize) break;

      // Look for values in float columns (xG, xA)
      for (const [colIndex, schemaId] of Object.entries(columnMap)) {
        const schema = schemaRegistry.get(schemaId);
        if (schema && schema.type === 'statistic') {
          const value = row[colIndex];
          // Skip empty values, zeros, and invalid values
          if (this.isValidFloatValue(value) && !this.isEmptyOrZero(value)) {
            sample.push({ column: schemaId, rowIndex: row.index || 0, value });
            if (sample.length >= targetSampleSize) break;
          }
        }
      }

      // Also sample from attribute columns (1-20 range)
      for (const [colIndex, schemaId] of Object.entries(columnMap)) {
        if (sample.length >= targetSampleSize) break;

        const schema = schemaRegistry.get(schemaId);
        if (schema && schema.type === 'attribute') {
          const value = row[colIndex];
          if (this.isValidAttributeValue(value)) {
            sample.push({ column: schemaId, rowIndex: row.index || 0, value });
            if (sample.length >= targetSampleSize) break;
          }
        }
      }

      // Also sample from currency columns
      for (const [colIndex, schemaId] of Object.entries(columnMap)) {
        if (sample.length >= targetSampleSize) break;

        const schema = schemaRegistry.get(schemaId);
        if (schema && (schema.type === 'currency' || schema.supportsFrequency)) {
          const value = row[colIndex];
          if (this.isValidCurrencyValue(value)) {
            sample.push({ column: schemaId, rowIndex: row.index || 0, value });
            if (sample.length >= targetSampleSize) break;
          }
        }
      }
    }

    return sample;
  }
}

// Export to global scope
window.FormatInspector = FormatInspector;
