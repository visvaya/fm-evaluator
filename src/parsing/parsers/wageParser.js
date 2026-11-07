/**
 * WageParser - Parses wage values with frequency normalization
 */
import { CurrencyParser } from './currencyParser.js';

export class WageParser {
  constructor() {
    this.currencyParser = new CurrencyParser();
  }

  /**
   * Detect wage frequency from value string
   * @param value - Raw value string
   * @param languageConfig - Language configuration
   * @returns Frequency (yearly, monthly, weekly)
   */
  _detectFrequency(value, languageConfig) {
    const lowerValue = value.toLowerCase();

    // Check for weekly indicators
    if (/\b(p\/w|p\/tyg|tyg\.|weekly|semanal|semaine|woche)\b/i.test(lowerValue)) {
      return 'weekly';
    }

    // Check for monthly indicators
    if (/\b(p\/m|p\/mies|mies\.|monthly|mensual|mensuel|monat)\b/i.test(lowerValue)) {
      return 'monthly';
    }

    // Check for yearly indicators
    if (/\b(p\/a|p\/rok|rok\.|yearly|anual|annuel|jahr)\b/i.test(lowerValue)) {
      return 'yearly';
    }

    // Default to yearly if no indicator found
    return 'yearly';
  }

  /**
   * Parse wage value with frequency normalization
   * @param value - Raw wage string
   * @param formatContext - Format context
   * @param normalizationConfig - Normalization configuration
   * @param languageConfig - Language configuration
   * @returns Normalized wage value or null
   */
  parse(value, formatContext = {}, normalizationConfig = null, languageConfig = {}) {
    // First parse as currency
    const currencyValue = this.currencyParser.parseCurrency(value, formatContext, languageConfig);

    if (currencyValue === null) {
      return null;
    }

    // Detect frequency from value string
    const frequency = this._detectFrequency(value, languageConfig);

    // Normalize if config provided
    if (normalizationConfig) {
      const multiplier = normalizationConfig.getWageMultiplier(frequency);
      return currencyValue * multiplier;
    }

    return currencyValue;
  }
}
