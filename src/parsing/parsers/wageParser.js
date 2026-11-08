/**
 * WageParser - Parses wage values with frequency normalization
 */
import { CurrencyParser } from './currencyParser.js';

// Checked in this order; a value without any of them is yearly. A token ends where no word
// character follows, so a dotted abbreviation also matches at the end ("tyg.").
const FREQUENCY_PATTERNS = [
  ['weekly', /\b(?:p\/w|p\/tyg|tyg\.|weekly|semanal|semaine|woche)(?!\w)/i],
  ['monthly', /\b(?:p\/m|p\/mies|mies\.|monthly|mensual|mensuel|monat)(?!\w)/i],
  ['yearly', /\b(?:p\/a|p\/rok|rok\.|yearly|anual|annuel|jahr)(?!\w)/i]
];

/**
 * Splits a raw wage into its frequency and the amount without the frequency token, so that a
 * multiplier suffix stays at the end of the amount ("250K zł p/tyg" -> "250K zł", weekly).
 */
function splitFrequency(value) {
  if (typeof value !== 'string') return { amount: value, frequency: 'yearly' };
  for (const [frequency, pattern] of FREQUENCY_PATTERNS) {
    const match = pattern.exec(value);
    if (match) {
      const amount = value.slice(0, match.index) + value.slice(match.index + match[0].length);
      return { amount, frequency };
    }
  }
  return { amount: value, frequency: 'yearly' };
}

export class WageParser {
  constructor() {
    this.currencyParser = new CurrencyParser();
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
    const { amount, frequency } = splitFrequency(value);
    const currencyValue = this.currencyParser.parseCurrency(amount, formatContext, languageConfig);

    if (currencyValue === null) {
      return null;
    }

    // Normalize if config provided
    if (normalizationConfig) {
      const multiplier = normalizationConfig.getWageMultiplier(frequency);
      return currencyValue * multiplier;
    }

    return currencyValue;
  }
}
