import { COUNTRY_CODE_MAP, mapCountryCode } from '../config/constants';

function buildEnglishNameIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const mapping of Object.values(COUNTRY_CODE_MAP)) {
    if (!mapping) continue;
    const plName = Array.isArray(mapping.pl) ? mapping.pl[0] : mapping.pl;
    if (!plName) continue;
    const enNames = Array.isArray(mapping.en) ? mapping.en : [mapping.en];
    for (const enName of enNames) {
      if (enName) {
        index.set(enName.toLowerCase(), plName);
      }
    }
  }
  return index;
}

const englishNameIndex = buildEnglishNameIndex();

/**
 * Normalizes a nation value from player data to the canonical (Polish) form
 * used by the LDC league list: FM codes ('ENG') and full English names
 * ('England') both resolve to 'Anglia'. Unknown values pass through so that
 * strict name+nation identity is preserved (no cross-country guessing).
 */
export function canonicalizeNation(value: null | string): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.length === 0) return '';
  const fromCode = mapCountryCode(trimmed);
  if (fromCode !== trimmed) return fromCode;
  return englishNameIndex.get(trimmed.toLowerCase()) ?? trimmed;
}
