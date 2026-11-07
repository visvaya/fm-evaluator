/**
 * UniversalParser - Universal parser that routes to appropriate specialized parsers
 */
import { AttributeParser } from './parsers/attributeParser.js';
import { CurrencyParser } from './parsers/currencyParser.js';
import { DateParser } from './parsers/dateParser.js';
import { DistanceParser } from './parsers/distanceParser.js';
import { StatisticParser } from './parsers/statisticParser.js';
import { WageParser } from './parsers/wageParser.js';

export class UniversalParser {
  constructor() {
    this.attributeParser = new AttributeParser();
    this.statisticParser = new StatisticParser();
    this.currencyParser = new CurrencyParser();
    this.dateParser = new DateParser();
    this.wageParser = new WageParser();
    this.distanceParser = new DistanceParser();
  }

  /**
   * Escape special regex characters
   * @param str - String to escape
   * @returns Escaped string
   */
  _escapeRegex(str) {
    return str.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  }

  /**
   * Parse value based on schema type
   * @param value - Raw value string
   * @param schemaInfo - Schema information
   * @param formatContext - Format context
   * @param normalizationConfig - Normalization configuration
   * @param languageConfig - Language configuration
   * @returns Parsed value (type depends on schema)
   */
  parse(value, schemaInfo, formatContext = {}, normalizationConfig = null, languageConfig = {}) {
    if (!schemaInfo) {
      return value; // Pass through if no schema
    }

    const type = schemaInfo.type;

    switch (type) {
      case 'attribute': {
        return this.attributeParser.parse(value);
      }

      case 'currency': {
        if (schemaInfo.supportsFrequency) {
          // Use wage parser for wages
          return this.wageParser.parse(value, formatContext, normalizationConfig, languageConfig);
        }
        return this.currencyParser.parseCurrency(value, formatContext, languageConfig);
      }

      case 'date': {
        return this.dateParser.parse(value, formatContext);
      }

      case 'enum': {
        return this.parseEnum(value, schemaInfo, languageConfig);
      }

      case 'integer': {
        return this.parseInt(value, formatContext);
      }

      case 'physical': {
        return this.parsePhysical(value, formatContext);
      }
      case 'statistic': {
        return this.statisticParser.parse(value, formatContext);
      }

      case 'string':

      case 'string_pass_through': {
        return value;
      } // Pass through

      default: {
        return value;
      } // Default: pass through
    }
  }

  /**
   * Parse distance value
   * @param value - Raw value string
   * @param formatContext - Format context
   * @param normalizationConfig - Normalization configuration
   * @returns Parsed distance or null
   */
  parseDistance(value, formatContext = {}, normalizationConfig = null) {
    return this.distanceParser.parse(value, formatContext, normalizationConfig);
  }

  /**
   * Parse enum value with translations
   * @param value - Raw enum value
   * @param schemaInfo - Schema information
   * @param languageConfig - Language configuration
   * @returns Translated value
   */
  parseEnum(value, schemaInfo, languageConfig) {
    if (!value || !languageConfig.valueTranslations) {
      return value;
    }

    // First try schema-specific translation
    let translations = languageConfig.valueTranslations[schemaInfo.id];

    // Fallback to shared keys for values that share translations
    if (!translations) {
      // Foot strength: left_foot and right_foot use same values
      if (schemaInfo.id === 'basic_left_foot' || schemaInfo.id === 'basic_right_foot') {
        translations = languageConfig.valueTranslations['foot_strength'];
      }
      // Position: basic_position and basic_sec_position use same values
      else if (schemaInfo.id === 'basic_position' || schemaInfo.id === 'basic_sec_position') {
        translations = languageConfig.valueTranslations['position'];
      }
    }

    if (translations && translations[value]) {
      return translations[value];
    }

    return value;
  }

  /**
   * Parse integer value
   * @param value - Raw value string
   * @param formatContext - Format context
   * @returns Parsed integer or null
   */
  parseInt(value, formatContext = {}) {
    if (!value || value === '' || value === '-') {
      return null;
    }

    let str = String(value).trim();

    // Remove thousand separators
    const thousandSep = formatContext.thousandSeparator;
    if (thousandSep) {
      const escapedSep = this._escapeRegex(thousandSep);
      str = str.replaceAll(new RegExp(escapedSep, 'g'), '');
    }

    // Remove non-breaking spaces
    str = str.replaceAll('\u00A0', ' ').replaceAll(/\s+/g, '');

    const num = parseInt(str, 10);
    return isNaN(num) ? null : num;
  }

  /**
   * Parse physical value (height/weight) with aggressive cleaning
   * @param value - Raw value string
   * @param formatContext - Format context
   * @returns Parsed value or null
   */
  parsePhysical(value, formatContext = {}) {
    if (!value || value === '' || value === '-') {
      return null;
    }

    let str = String(value).trim();

    // Aggressive cleaning: remove everything that's not a digit or decimal separator
    str = str.replaceAll(/[^\d.,]/g, '');

    // Normalize decimal separator
    const decimalSep = formatContext.decimalSeparator || '.';
    if (decimalSep === ',') {
      str = str.replace(',', '.');
    }

    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }
}
