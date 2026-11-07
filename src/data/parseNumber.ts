/* eslint-disable sonarjs/cognitive-complexity */

export function parseNumber(str: unknown): null | number {
  if (!str) return null;
  let s = String(str).trim();
  if (s === '' || s === '-') return null;

  s = s
    .replaceAll(/\s*km\s*/gi, '')
    .replaceAll(/\s*cm\s*/gi, '')
    .replaceAll(/\s*mm\s*/gi, '')
    .replaceAll(/\b(m)\b/gi, '')
    .trim();
  s = s
    .replaceAll('€', '')
    .replaceAll(/\s*p\/[aw]/gi, '')
    .replaceAll(/\s*mln\s*/gi, 'M')
    .trim();

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
