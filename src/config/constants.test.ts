import { describe, expect, it } from 'vitest';

import { COUNTRY_CODE_MAP, FEET_MAPPING, mapCountryCode } from './constants';

describe('FEET_MAPPING', () => {
  it('should have multiple entries', () => {
    expect(Object.keys(FEET_MAPPING).length).toBeGreaterThanOrEqual(6);
  });

  it('should map "Very Strong" to 5', () => {
    expect(FEET_MAPPING['Very Strong']).toBe(5);
  });

  it('should map "Strong" to 4', () => {
    expect(FEET_MAPPING.Strong).toBe(4);
  });

  it('should map "Fairly Strong" to 3', () => {
    expect(FEET_MAPPING['Fairly Strong']).toBe(3);
  });

  it('should map "Reasonable" to 2', () => {
    expect(FEET_MAPPING.Reasonable).toBe(2);
  });

  it('should map "Weak" to 1', () => {
    expect(FEET_MAPPING.Weak).toBe(1);
  });

  it('should map "Very Weak" to 0', () => {
    expect(FEET_MAPPING['Very Weak']).toBe(0);
  });

  it('should contain all strength values from 0 to 5', () => {
    const values = Object.values(FEET_MAPPING);
    expect(values).toContain(0);
    expect(values).toContain(1);
    expect(values).toContain(2);
    expect(values).toContain(3);
    expect(values).toContain(4);
    expect(values).toContain(5);
  });
});

describe('COUNTRY_CODE_MAP', () => {
  it('should contain common country codes', () => {
    expect(COUNTRY_CODE_MAP.POL).toBeDefined();
    expect(COUNTRY_CODE_MAP.ENG).toBeDefined();
    expect(COUNTRY_CODE_MAP.ESP).toBeDefined();
    expect(COUNTRY_CODE_MAP.GER).toBeDefined();
    expect(COUNTRY_CODE_MAP.BRA).toBeDefined();
  });

  it('should have pl and en translations for each entry', () => {
    for (const mapping of Object.values(COUNTRY_CODE_MAP)) {
      if (mapping) {
        expect(mapping.pl).toBeDefined();
        expect(mapping.en).toBeDefined();
      }
    }
  });

  it('POL should map to Polska/Poland', () => {
    expect(COUNTRY_CODE_MAP.POL.pl).toBe('Polska');
    expect(COUNTRY_CODE_MAP.POL.en).toBe('Poland');
  });
});

describe('mapCountryCode', () => {
  it('should return Polish name by default', () => {
    expect(mapCountryCode('POL')).toBe('Polska');
  });

  it('should return English name when lang=en', () => {
    expect(mapCountryCode('POL', 'en')).toBe('Poland');
  });

  it('should be case-insensitive', () => {
    expect(mapCountryCode('pol')).toBe('Polska');
    expect(mapCountryCode('Pol')).toBe('Polska');
  });

  it('should trim whitespace', () => {
    expect(mapCountryCode('  POL  ')).toBe('Polska');
  });

  it('should return original code for unknown codes', () => {
    expect(mapCountryCode('XYZ')).toBe('XYZ');
  });

  it('should return empty string for empty input', () => {
    expect(mapCountryCode('')).toBe('');
  });

  it('should handle array pl values (MHL = Marshall Islands)', () => {
    // MHL.pl is ['Wyspy Marshalla', 'Marshall'] – should return first element
    expect(mapCountryCode('MHL')).toBe('Wyspy Marshalla');
  });

  it('should return English name for MHL', () => {
    expect(mapCountryCode('MHL', 'en')).toBe('Marshall Islands');
  });

  it('should handle various European codes', () => {
    expect(mapCountryCode('FRA', 'en')).toBe('France');
    expect(mapCountryCode('ITA', 'en')).toBe('Italy');
    expect(mapCountryCode('NED', 'en')).toBe('Netherlands');
  });

  it('should handle Asian codes', () => {
    expect(mapCountryCode('JPN', 'en')).toBe('Japan');
    expect(mapCountryCode('CHN', 'en')).toBe('China');
  });
});
