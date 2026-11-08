import { getCurrentLanguage, t } from '../lib/i18nBridge';
import { splitTrailingParenthesis } from '../utils/splitTrailingParenthesis';

// Phase 5A: translateValue + translatePosition migrated from main.js

type PositionAbbreviations = Record<string, Record<string, string>>;

const COLUMN_NAME_MAP: Record<string, string> = {
  'EU National': 'EU National',
  'F/PT': 'F/PT',
  foot: 'Preferred Foot',
  'Home-Grown Status': 'Home-Grown Status',
  leftFootStars: 'Left Foot',
  'Media Handling': 'Media Handling',
  Nac: 'Nat',
  Narodowość: 'Nat',
  Nat: 'Nat',
  'Nat Fit': 'Nat',
  Nation: 'Nat',
  NSp: 'Nat',
  Personality: 'Personality',
  Phy: 'Nat',
  rightFootStars: 'Right Foot',
  Style: 'Style',
  Type: 'Type'
};

const TYPE_ABBREVIATION_MAP: PositionAbbreviations = {
  de: { AM: 'OM', D: 'V', DM: 'DM', GK: 'TW', M: 'M', ST: 'ST', WB: 'WB' },
  en: { AM: 'AM', D: 'D', DM: 'DM', GK: 'GK', M: 'M', ST: 'ST', WB: 'WB' },
  es: { AM: 'MO', D: 'D', DM: 'MD', GK: 'PO', M: 'M', ST: 'DL', WB: 'WB' },
  fr: { AM: 'MO', D: 'D', DM: 'MD', GK: 'GB', M: 'M', ST: 'A', WB: 'WB' },
  pl: { AM: 'OP', D: 'O', DM: 'DP', GK: 'BR', M: 'P', ST: 'N', WB: 'WO' }
};

const SIDE_ABBREVIATION_MAP: PositionAbbreviations = {
  de: { C: 'Z', L: 'L', LC: 'LZ', R: 'R', RC: 'RZ', RL: 'RL', RLC: 'RLZ' },
  en: { C: 'C', L: 'L', LC: 'LC', R: 'R', RC: 'RC', RL: 'RL', RLC: 'RLC' },
  es: { C: 'C', L: 'I', LC: 'IC', R: 'D', RC: 'DC', RL: 'DI', RLC: 'DIC' },
  fr: { C: 'C', L: 'G', LC: 'GC', R: 'D', RC: 'DC', RL: 'DG', RLC: 'DGC' },
  pl: { C: 'Ś', L: 'L', LC: 'LŚ', R: 'P', RC: 'PŚ', RL: 'PL', RLC: 'PLŚ' }
};

export function translatePosition(
  positionKey: null | string | undefined
): null | string | undefined {
  if (!positionKey || positionKey === '-' || positionKey === '') return positionKey;

  const lang: string = getCurrentLanguage() ?? 'en';

  // Single position without parentheses (e.g. 'GK', 'DM')
  const typeAbbr = TYPE_ABBREVIATION_MAP[lang]?.[positionKey];
  if (typeAbbr) return typeAbbr;

  // Combination positions with slash: "D/WB (L)" or "M/AM (C)"
  if (positionKey.includes('/')) {
    const match = splitTrailingParenthesis(positionKey);
    if (match) {
      const [types, side] = match;
      const normalizedTypes = types
        .split('/')
        .map((tp) => {
          const trimmed = tp.trim();
          return TYPE_ABBREVIATION_MAP[lang]?.[trimmed] || trimmed;
        })
        .join('/');
      const sideAbbr = SIDE_ABBREVIATION_MAP[lang]?.[side] || side;
      return `${normalizedTypes} (${sideAbbr})`;
    }
    // Combination without parentheses (e.g. "D/WB")
    const normalizedTypes = positionKey
      .split('/')
      .map((tp) => {
        const trimmed = tp.trim();
        return TYPE_ABBREVIATION_MAP[lang]?.[trimmed] || trimmed;
      })
      .join('/');
    return normalizedTypes;
  }

  // Format: 'X (Y)' where X is type, Y is side
  const match = splitTrailingParenthesis(positionKey);
  if (match) {
    const [type, side] = match;
    const tAbbr = TYPE_ABBREVIATION_MAP[lang]?.[type] || type;
    const sAbbr = SIDE_ABBREVIATION_MAP[lang]?.[side] || side;
    return `${tAbbr} (${sAbbr})`;
  }

  // Fallback: try i18n positions translation
  const translation = t(positionKey, 'positions');
  if (translation !== positionKey) return translation;

  return positionKey;
}

export function translateValue(
  value: null | string | undefined,
  columnName: string
): null | string | undefined {
  if (!value || value === '-' || value === '') return value;

  const lang: string = getCurrentLanguage() ?? 'en';
  if (lang === 'en') return value;

  const standardColumnName = COLUMN_NAME_MAP[columnName] || columnName;

  // Preserve 3-letter ISO country codes as-is
  if (standardColumnName === 'Nat' && /^[A-Z]{3}$/.test(value.trim())) {
    return value.trim();
  }

  // Try translation via i18n module
  return t(value, 'values') !== value ? t(value, 'values') : value;
}
