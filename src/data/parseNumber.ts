/* eslint-disable sonarjs/cognitive-complexity */

export function parseNumber(str: unknown): null | number {
  if (!str) return null;
  let s = String(str).trim();
  if (s === '' || s === '-') return null;

  s = stripUnitWords(s);

  let multiplier = 1;

  const hasM = /M|mil|mln/i.test(s);
  const hasK = /K|tys/i.test(s);

  if (hasM) {
    multiplier = 1_000_000;
    s = s.replaceAll(/M|mil|mln/gi, '');
  } else if (hasK) {
    multiplier = 1000;
    s = s.replaceAll(/K|tys/gi, '');
  }

  let clean = s.replaceAll(/[^\d,.-]/g, '').trim();
  if (clean === '' || clean === '-') return null;

  if (clean.includes(',') && !clean.includes('.')) {
    const parts = clean.split(',');
    if (parts.length === 2) {
      clean =
        parts[1].length === 3 && multiplier === 1
          ? clean.replaceAll(',', '')
          : clean.replace(',', '.');
    } else {
      clean = clean.replaceAll(',', '');
    }
  } else if (clean.includes('.') && !clean.includes(',')) {
    const parts = clean.split('.');
    if (parts.length === 2) {
      if (parts[1].length === 3 && multiplier === 1 && parts[0].length > 3) {
        clean = clean.replaceAll('.', '');
      }
    } else {
      clean = clean.replaceAll('.', '');
    }
  } else if (clean.includes(',') && clean.includes('.')) {
    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    clean =
      lastComma > lastDot ? clean.replaceAll('.', '').replace(',', '.') : clean.replaceAll(',', '');
  }

  const num = parseFloat(clean);
  if (isNaN(num)) return null;
  return num * multiplier;
}

/**
 * Removes distance units, the euro sign and wage periods, and shortens "mln" to "M".
 *
 * Leading whitespace is matched as `(?:(?<!\s)\s+)?`, so it can only start where a whitespace
 * run starts. A plain `\s*` made a global replace retry from every position of a long run and
 * scan the rest of the run each time (quadratic time); a match from inside a run reaches the
 * same text as one from its start, so the result does not change.
 */
export function stripUnitWords(text: string): string {
  const withoutDistance = text
    .replaceAll(/(?:(?<!\s)\s+)?km\s*/gi, '')
    .replaceAll(/(?:(?<!\s)\s+)?cm\s*/gi, '')
    .replaceAll(/(?:(?<!\s)\s+)?mm\s*/gi, '')
    .replaceAll(/\b(m)\b/gi, '')
    .trim();
  return withoutDistance
    .replaceAll('€', '')
    .replaceAll(/(?:(?<!\s)\s+)?p\/[aw]/gi, '')
    .replaceAll(/(?:(?<!\s)\s+)?mln\s*/gi, 'M')
    .trim();
}
