import { splitRange } from '../data/splitRange';

/**
 * Handle value ranges (e.g. "1K - 2K") and other quirks
 */
export function cleanValue(val: any, isWage = false): null | number | string {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;

  const s = val.toString().trim();
  // Missing-data symbols (Polish and English)
  const missingSymbols = [
    '-',
    '',
    'N/A',
    'N/D',
    'n/d',
    'brak',
    'none',
    'N/d',
    'Nieznane',
    'Nieznany',
    'Nieznana',
    'Unknown'
  ];
  if (missingSymbols.includes(s)) {
    return isWage ? 0 : null;
  }

  // 1. Foot strength mapping (text -> number 0-5)
  const strengthMap: Record<string, number> = {
    'Bardzo mocna': 5,
    'Bardzo słaba': 0,
    'Fairly Strong': 3,
    Mocna: 4,
    Przyzwoita: 2,
    Reasonable: 2,
    Słaba: 1,
    Strong: 4,
    'Very Strong': 5,
    'Very Weak': 0,
    Weak: 1,
    'Względnie mocna': 3
  };
  if (strengthMap[s] !== undefined) {
    return strengthMap[s];
  }

  // 2. Ranges (e.g. "1K € - 6K €" or "12-15")
  // If the range contains a currency or unit (K, M, tys, mln), keep it as a string for readability in the UI
  if (
    (s.includes('-') || s.includes('–') || s.includes('\u2014')) &&
    s.length < 50 &&
    /\d/.test(s)
  ) {
    const hasCurrencyOrUnit = /[€$£KM]|p\/[aw]|tys|mln|mil/i.test(s);
    if (hasCurrencyOrUnit) {
      return s; // Keep as a string for display
    }

    // For plain numeric ranges (e.g. attributes 12-15), parse and return the mean
    const rangeMatch = splitRange(s);
    if (rangeMatch) {
      const v1 = parseNumber(rangeMatch[0]);
      const v2 = parseNumber(rangeMatch[1]);
      if (v1 !== null && v2 !== null) {
        return (v1 + v2) / 2;
      }
    }
  }

  const num = parseNumber(s);
  return num === null ? s : num; // Return the number if parsing succeeded, otherwise the original
}

/**
 * Safely parse numbers from PL/EN strings
 * Handles:
 * - Suffixes: K, M, mln
 * - Currencies: €, p/a, p/w
 * - Separators: , . (locale detection)
 * - Units: km, cm, mm (removed)
 */
export function parseNumber(str: any): null | number {
  if (str === null || str === undefined) return null;
  let s = str.toString().trim();
  if (s === '' || s === '-') return null;

  // Remove length units BEFORE checking for K/M suffixes
  // 'km' won't be treated as 'K' (thousands)
  s = s
    .replaceAll(/\s*km\s*/gi, '')
    .replaceAll(/\s*cm\s*/gi, '')
    .replaceAll(/\s*mm\s*/gi, '')
    .replaceAll(/\b(m)\b/gi, '')
    .trim();

  // Remove currencies and other units (€, p/a, p/w, etc.)
  s = s
    .replaceAll('€', '')
    .replaceAll(/\s*p\/[aw]/gi, '')
    .replaceAll(/\s*mln\s*/gi, 'M')
    .trim();

  // Check K/M/tys/mln suffixes
  let multiplier = 1;
  const hasM = /M|mil|mln/i.test(s);
  const hasK = /K|tys/i.test(s);

  if (hasM) {
    multiplier = 1000000;
    s = s.replaceAll(/M|mil|mln/gi, '');
  } else if (hasK) {
    multiplier = 1000;
    s = s.replaceAll(/K|tys/gi, '');
  }

  // Remove everything properly except digits, commas, dots, minus
  let clean = s.replaceAll(/[^\d,.-]/g, '').trim();
  if (clean === '' || clean === '-') return null;

  // Logic for Locale handling
  // "17,750" -> 17750
  // "4.5" -> 4.5
  // "1.234,56" -> 1234.56
  // "1,234.56" -> 1234.56

  if (clean.includes(',') && !clean.includes('.')) {
    // Only comma - check if thousands or decimal
    const parts = clean.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Likely decimal (e.g. "12,45")
      clean = clean.replace(',', '.');
    } else {
      // Likely thousands (e.g. "17,750")
      clean = clean.replaceAll(',', '');
    }
  } else if (clean.includes(',') && clean.includes('.')) {
    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    if (lastComma > lastDot) {
      // 1.234,56 - dot = thousands, comma = decimal
      clean = clean.replaceAll('.', '').replace(',', '.');
    } else {
      // 1,234.56 - comma = thousands, dot = decimal
      clean = clean.replaceAll(',', '');
    }
  }

  const num = parseFloat(clean);
  if (isNaN(num)) return null;
  return num * multiplier;
}
