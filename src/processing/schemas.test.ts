import { describe, expect, it } from 'vitest';

import {
  AttributeSchema,
  CurrencySchema,
  DateSchema,
  FileMetadataSchema,
  PlayerSchema,
  StatisticSchema
} from './schemas';

// ---------------------------------------------------------------------------
// Primitive sub-schemas
// ---------------------------------------------------------------------------

describe('AttributeSchema', () => {
  it('should accept values 1-20', () => {
    expect(AttributeSchema.parse(1)).toBe(1);
    expect(AttributeSchema.parse(20)).toBe(20);
    expect(AttributeSchema.parse(10)).toBe(10);
  });

  it('should accept null and undefined', () => {
    expect(AttributeSchema.parse(null)).toBeNull();
    expect(AttributeSchema.parse(undefined)).toBeUndefined();
  });

  it('should reject values outside 1-20', () => {
    expect(() => AttributeSchema.parse(0)).toThrow();
    expect(() => AttributeSchema.parse(21)).toThrow();
    expect(() => AttributeSchema.parse(-5)).toThrow();
  });

  it('should reject non-numeric values', () => {
    expect(() => AttributeSchema.parse('abc')).toThrow();
  });
});

describe('CurrencySchema', () => {
  it('should accept numbers, null, undefined', () => {
    expect(CurrencySchema.parse(1200000)).toBe(1200000);
    expect(CurrencySchema.parse(0)).toBe(0);
    expect(CurrencySchema.parse(null)).toBeNull();
    expect(CurrencySchema.parse(undefined)).toBeUndefined();
  });

  it('should accept negative numbers (debt)', () => {
    expect(CurrencySchema.parse(-500)).toBe(-500);
  });

  it('should reject strings', () => {
    expect(() => CurrencySchema.parse('1.2M')).toThrow();
  });
});

describe('StatisticSchema', () => {
  it('should accept numbers', () => {
    expect(StatisticSchema.parse(42)).toBe(42);
    expect(StatisticSchema.parse(7.18)).toBe(7.18);
  });

  it('should accept strings (e.g. "30 (4)" sub-appearances)', () => {
    expect(StatisticSchema.parse('30 (4)')).toBe('30 (4)');
  });

  it('should accept null and undefined', () => {
    expect(StatisticSchema.parse(null)).toBeNull();
    expect(StatisticSchema.parse(undefined)).toBeUndefined();
  });
});

describe('DateSchema', () => {
  it('should accept Date objects and strings', () => {
    const d = new Date('1997-03-12');
    expect(DateSchema.parse(d)).toEqual(d);
    expect(DateSchema.parse('12.3.1997')).toBe('12.3.1997');
  });

  it('should accept null and undefined', () => {
    expect(DateSchema.parse(null)).toBeNull();
    expect(DateSchema.parse(undefined)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PlayerSchema
// ---------------------------------------------------------------------------

describe('PlayerSchema', () => {
  const minimalPlayer = {
    basic_name: 'James Richardson',
    basic_uid: '90000001'
  };

  it('should accept a minimal valid player (name + uid)', () => {
    const result = PlayerSchema.parse(minimalPlayer);
    expect(result.basic_name).toBe('James Richardson');
    expect(result.basic_uid).toBe('90000001');
  });

  it('should reject player without name', () => {
    expect(() => PlayerSchema.parse({ basic_uid: '1' })).toThrow();
  });

  it('should reject player without uid', () => {
    expect(() => PlayerSchema.parse({ basic_name: 'Test' })).toThrow();
  });

  it('should accept full player object with attributes', () => {
    const fullPlayer = {
      ...minimalPlayer,
      attribute_acceleration: 15,
      attribute_decisions: 12,
      attribute_finishing: 10,
      attribute_pace: 13,
      attribute_stamina: 14,
      basic_club: 'Northampton Town',
      basic_division: 'EFL League One',
      basic_dob: '12.3.1997 (27 years old)',
      basic_left_foot: 'Reasonable',
      basic_nationality: 'ENG',
      basic_position: 'M (C)',
      basic_right_foot: 'Very Strong',
      basic_transfer_value: 1200000,
      basic_wage: 18000,
      index: 0,
      rowId: 'row-0',
      statistic_apps: '34',
      statistic_goals: 6,
      statistic_xg: 4.52
    };
    const result = PlayerSchema.parse(fullPlayer);
    expect(result.attribute_pace).toBe(13);
    expect(result.statistic_goals).toBe(6);
  });

  it('should reject attribute outside 1-20 range', () => {
    expect(() => PlayerSchema.parse({ ...minimalPlayer, attribute_pace: 25 })).toThrow();
  });

  it('should accept null attributes (unscouted)', () => {
    const result = PlayerSchema.parse({
      ...minimalPlayer,
      attribute_pace: null,
      attribute_stamina: null
    });
    expect(result.attribute_pace).toBeNull();
  });

  it('should passthrough unknown keys', () => {
    const result = PlayerSchema.parse({
      ...minimalPlayer,
      custom_field: 'hello',
      original_header_xyz: 42
    });
    expect((result as any).custom_field).toBe('hello');
    expect((result as any).original_header_xyz).toBe(42);
  });

  it('should accept valid index (non-negative integer)', () => {
    const result = PlayerSchema.parse({ ...minimalPlayer, index: 0 });
    expect(result.index).toBe(0);
  });

  it('should reject negative index', () => {
    expect(() => PlayerSchema.parse({ ...minimalPlayer, index: -1 })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// FileMetadataSchema
// ---------------------------------------------------------------------------

describe('FileMetadataSchema', () => {
  const validMeta = {
    detectedLanguage: 'en',
    missingOptional: ['basic_asking_price'],
    missingRequired: [],
    name: 'sample-attributes-en.html',
    parsedData: [{ basic_name: 'James Richardson', basic_uid: '90000001' }],
    rowCount: 5,
    type: 'attr' as const,
    valid: true
  };

  it('should accept valid file metadata', () => {
    const result = FileMetadataSchema.parse(validMeta);
    expect(result.name).toBe('sample-attributes-en.html');
    expect(result.rowCount).toBe(5);
    expect(result.valid).toBe(true);
  });

  it('should reject unknown type', () => {
    expect(() => FileMetadataSchema.parse({ ...validMeta, type: 'invalid' })).toThrow();
  });

  it('should accept all valid types', () => {
    for (const type of ['attr', 'stats', 'both', 'complete', 'unknown']) {
      const result = FileMetadataSchema.parse({ ...validMeta, type });
      expect(result.type).toBe(type);
    }
  });

  it('should reject negative rowCount', () => {
    expect(() => FileMetadataSchema.parse({ ...validMeta, rowCount: -1 })).toThrow();
  });

  it('should reject missing name', () => {
    const { name: _name, ...noName } = validMeta;
    expect(() => FileMetadataSchema.parse(noName)).toThrow();
  });

  it('should reject missing valid flag', () => {
    const { valid: _valid, ...noValid } = validMeta;
    expect(() => FileMetadataSchema.parse(noValid)).toThrow();
  });

  it('should validate nested parsedData against PlayerSchema', () => {
    expect(() =>
      FileMetadataSchema.parse({
        ...validMeta,
        parsedData: [{ basic_name: 'No UID' }] // missing basic_uid
      })
    ).toThrow();
  });
});
