// @vitest-environment jsdom
/**
 * Tests for FormatInspector and NormalizationConfig
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Load dependencies first
import './parsers/attributeParser.js';
import './parsers/currencyParser.js';
import './parsers/dateParser.js';
import './parsers/distanceParser.js';
import './parsers/statisticParser.js';
import './parsers/wageParser.js';

// SchemaRegistry mock (FormatInspector needs it)
beforeAll(async () => {
  if (!(window as any).SchemaRegistry) {
    // @ts-ignore
    await import('../schema/schemaRegistry.js');
  }
});

import { NormalizationConfig } from './normalizationConfig.js';
import './formatInspector.js';

// ============================================================================
// NormalizationConfig
// ============================================================================

describe('NormalizationConfig', () => {
  describe('constructor defaults', () => {
    it('should default to yearly wage and km distance', () => {
      const config = new NormalizationConfig();
      expect(config.targetWageFrequency).toBe('yearly');
      expect(config.targetDistanceUnit).toBe('km');
    });
  });

  describe('fromSettings', () => {
    it('should override defaults from settings', () => {
      const config = NormalizationConfig.fromSettings({
        targetDistanceUnit: 'mi',
        targetWageFrequency: 'monthly',
        unknownUnitMultipliers: { foo: 2 }
      });
      expect(config.targetWageFrequency).toBe('monthly');
      expect(config.targetDistanceUnit).toBe('mi');
      expect(config.unknownUnitMultipliers.foo).toBe(2);
    });

    it('should use defaults when settings is empty', () => {
      const config = NormalizationConfig.fromSettings({});
      expect(config.targetWageFrequency).toBe('yearly');
    });
  });

  describe('getWageMultiplier', () => {
    it('should return 1 for same frequency', () => {
      const config = new NormalizationConfig();
      config.targetWageFrequency = 'yearly';
      expect(config.getWageMultiplier('yearly')).toBe(1);
    });

    it('should convert monthly→yearly (*12)', () => {
      const config = new NormalizationConfig();
      config.targetWageFrequency = 'yearly';
      expect(config.getWageMultiplier('monthly')).toBe(12);
    });

    it('should convert weekly→yearly (*52)', () => {
      const config = new NormalizationConfig();
      config.targetWageFrequency = 'yearly';
      expect(config.getWageMultiplier('weekly')).toBe(52);
    });

    it('should convert yearly→monthly (/12)', () => {
      const config = new NormalizationConfig();
      config.targetWageFrequency = 'monthly';
      expect(config.getWageMultiplier('yearly')).toBeCloseTo(1 / 12, 5);
    });

    it('should convert yearly→weekly (/52)', () => {
      const config = new NormalizationConfig();
      config.targetWageFrequency = 'weekly';
      expect(config.getWageMultiplier('yearly')).toBeCloseTo(1 / 52, 5);
    });

    it('should handle unknown frequency (default to yearly)', () => {
      const config = new NormalizationConfig();
      expect(config.getWageMultiplier('biweekly')).toBe(1);
    });
  });

  describe('getDistanceMultiplier', () => {
    it('should return 1 for km→km', () => {
      const config = new NormalizationConfig();
      expect(config.getDistanceMultiplier('km')).toBe(1);
    });

    it('should convert mi→km (~1.609)', () => {
      const config = new NormalizationConfig();
      expect(config.getDistanceMultiplier('mi')).toBeCloseTo(1.60934, 3);
    });

    it('should convert m→km (0.001)', () => {
      const config = new NormalizationConfig();
      expect(config.getDistanceMultiplier('m')).toBeCloseTo(0.001, 5);
    });

    it('should convert yd→km (~0.0009144)', () => {
      const config = new NormalizationConfig();
      expect(config.getDistanceMultiplier('yd')).toBeCloseTo(0.0009144, 5);
    });

    it('should convert km→mi when target is mi', () => {
      const config = NormalizationConfig.fromSettings({ targetDistanceUnit: 'mi' });
      expect(config.getDistanceMultiplier('km')).toBeCloseTo(1 / 1.60934, 3);
    });
  });

  describe('getUnknownUnitMultiplier', () => {
    it('should return null for undefined unit', () => {
      const config = new NormalizationConfig();
      expect(config.getUnknownUnitMultiplier('foo')).toBeNull();
    });

    it('should return multiplier for configured unit', () => {
      const config = NormalizationConfig.fromSettings({
        unknownUnitMultipliers: { foo: 3.5 }
      });
      expect(config.getUnknownUnitMultiplier('foo')).toBe(3.5);
    });
  });
});

// ============================================================================
// FormatInspector – helper methods
// ============================================================================

describe('FormatInspector', () => {
  let inspector: any;
  beforeAll(() => {
    inspector = new (window as any).FormatInspector();
  });

  describe('isValidFloatValue', () => {
    it('should accept decimal numbers', () => {
      expect(inspector.isValidFloatValue('7.18')).toBe(true);
      expect(inspector.isValidFloatValue('7,18')).toBe(true);
    });

    it('should accept integers', () => {
      expect(inspector.isValidFloatValue('42')).toBe(true);
    });

    it('should reject empty/null/dash', () => {
      expect(inspector.isValidFloatValue('')).toBe(false);
      expect(inspector.isValidFloatValue(null)).toBe(false);
      expect(inspector.isValidFloatValue('-')).toBe(false);
    });
  });

  describe('isEmptyOrZero', () => {
    it('should return true for empty, dash, N/A, zero', () => {
      expect(inspector.isEmptyOrZero('')).toBe(true);
      expect(inspector.isEmptyOrZero('-')).toBe(true);
      expect(inspector.isEmptyOrZero('N/A')).toBe(true);
      expect(inspector.isEmptyOrZero('0')).toBe(true);
      expect(inspector.isEmptyOrZero('0.00')).toBe(true);
    });

    it('should return false for non-zero values', () => {
      expect(inspector.isEmptyOrZero('7.18')).toBe(false);
      expect(inspector.isEmptyOrZero('1')).toBe(false);
    });
  });

  describe('isValidAttributeValue', () => {
    it('should accept 1-20', () => {
      expect(inspector.isValidAttributeValue('1')).toBe(true);
      expect(inspector.isValidAttributeValue('20')).toBe(true);
      expect(inspector.isValidAttributeValue('14')).toBe(true);
    });

    it('should reject 0, 21, empty', () => {
      expect(inspector.isValidAttributeValue('0')).toBe(false);
      expect(inspector.isValidAttributeValue('21')).toBe(false);
      expect(inspector.isValidAttributeValue('')).toBe(false);
    });
  });

  describe('isValidCurrencyValue', () => {
    it('should accept values with currency symbols', () => {
      expect(inspector.isValidCurrencyValue('€1000')).toBe(true);
      expect(inspector.isValidCurrencyValue('$500')).toBe(true);
    });

    it('should accept numeric values', () => {
      expect(inspector.isValidCurrencyValue('1000')).toBe(true);
    });

    it('should reject empty/null/dash', () => {
      expect(inspector.isValidCurrencyValue('')).toBe(false);
      expect(inspector.isValidCurrencyValue('-')).toBe(false);
    });
  });

  describe('detectDecimalSeparator', () => {
    it('should detect dot separator', () => {
      const sample = [{ value: '7.18' }, { value: '4.52' }, { value: '3.80' }];
      expect(inspector.detectDecimalSeparator(sample)).toBe('.');
    });

    it('should detect comma separator (Polish)', () => {
      const sample = [{ value: '7,18' }, { value: '4,52' }, { value: '3,80' }];
      expect(inspector.detectDecimalSeparator(sample)).toBe(',');
    });

    it('should default to dot when no clear pattern', () => {
      expect(inspector.detectDecimalSeparator([])).toBe('.');
    });
  });

  describe('detectThousandSeparator', () => {
    it('should detect comma as thousand separator', () => {
      const sample = [{ value: '1,845' }, { value: '2,580' }];
      expect(inspector.detectThousandSeparator(sample)).toBe(',');
    });

    it(String.raw`should detect NBSP as space thousand separator (\s matches NBSP)`, () => {
      // Note: JS regex \s matches \u00A0, so spaceCount increments before nbspCount
      // FormatInspector returns ' ' (space) – not \u00A0 – due to regex ordering
      const sample = [{ value: '1\u00A0845' }, { value: '2\u00A0580' }];
      expect(inspector.detectThousandSeparator(sample)).toBe(' ');
    });

    it('should return null when no separator detected', () => {
      const sample = [{ value: '42' }, { value: '7' }];
      expect(inspector.detectThousandSeparator(sample)).toBeNull();
    });
  });

  describe('detectCurrency', () => {
    it('should detect euro', () => {
      const sample = [{ value: '€1000' }, { value: '€500' }];
      expect(inspector.detectCurrency(sample)).toBe('€');
    });

    it('should return null for mixed currencies', () => {
      const sample = [{ value: '€1000' }, { value: '$500' }];
      expect(inspector.detectCurrency(sample)).toBeNull();
    });

    it('should return null when no currency symbols', () => {
      const sample = [{ value: '1000' }];
      expect(inspector.detectCurrency(sample)).toBeNull();
    });
  });

  describe('detectDateFormat', () => {
    it('should detect DD/MM when day > 12', () => {
      const sample = [{ value: '25/3/1997' }, { value: '15/6/2000' }];
      const result = inspector.detectDateFormat(sample);
      expect(result.format).toBe('DD/MM');
    });

    it('should detect MM/DD when month position > 12 is in second slot', () => {
      const sample = [{ value: '3/25/1997' }, { value: '6/15/2000' }];
      const result = inspector.detectDateFormat(sample);
      expect(result.format).toBe('MM/DD');
    });

    it('should detect dot separator', () => {
      const sample = [{ value: '25.3.1997' }, { value: '15.6.2000' }];
      const result = inspector.detectDateFormat(sample);
      expect(result.separator).toBe('.');
    });

    it('should return AMBIGUOUS when both <= 12', () => {
      const sample = [{ value: '1/2/2000' }, { value: '3/4/2001' }];
      const result = inspector.detectDateFormat(sample);
      expect(result.format).toBe('AMBIGUOUS');
    });

    it('should recognise dates with a trailing age suffix', () => {
      const sample = [{ value: '16.9.1992 (31 years old)' }, { value: '25.1.2006 (18 l.)' }];
      const result = inspector.detectDateFormat(sample);
      expect(result).toEqual({ confidence: 1, format: 'DD/MM', separator: '.' });
    });

    it('should default when no date values in sample', () => {
      const result = inspector.detectDateFormat([]);
      expect(result.format).toBe('DD/MM');
      expect(result.confidence).toBe(0.5);
    });
  });

  describe('detectWageFrequencies', () => {
    it('should detect weekly (p/w, p/tyg)', () => {
      const sample = [{ value: '1000 p/w' }];
      const freqs = inspector.detectWageFrequencies(sample, {});
      expect(freqs.has('weekly')).toBe(true);
    });

    it('should detect monthly (p/m, p/mies)', () => {
      const sample = [{ value: '18000 p/m' }];
      const freqs = inspector.detectWageFrequencies(sample, {});
      expect(freqs.has('monthly')).toBe(true);
    });

    it('should detect yearly (p/a)', () => {
      const sample = [{ value: '120000 p/a' }];
      const freqs = inspector.detectWageFrequencies(sample, {});
      expect(freqs.has('yearly')).toBe(true);
    });

    it('should detect multiple frequencies', () => {
      const sample = [{ value: '1000 p/w' }, { value: '5000 p/m' }];
      const freqs = inspector.detectWageFrequencies(sample, {});
      expect(freqs.has('weekly')).toBe(true);
      expect(freqs.has('monthly')).toBe(true);
    });
  });

  describe('detectDistanceUnits', () => {
    it('should detect km', () => {
      const sample = [{ value: '342.5 km' }];
      expect(inspector.detectDistanceUnits(sample).has('km')).toBe(true);
    });

    it('should detect mi', () => {
      const sample = [{ value: '100 mi' }];
      expect(inspector.detectDistanceUnits(sample).has('mi')).toBe(true);
    });
  });

  describe('calculateConfidence', () => {
    it('should return 0 for empty sample', () => {
      expect(inspector.calculateConfidence([])).toBe(0);
    });

    it('should return base 0.5+ for non-empty sample', () => {
      const sample = [{ value: '42' }];
      expect(inspector.calculateConfidence(sample)).toBeGreaterThanOrEqual(0.5);
    });

    it('should increase confidence with currency symbols', () => {
      const plain = [{ value: '42' }];
      const withCurrency = [{ value: '€42' }];
      expect(inspector.calculateConfidence(withCurrency)).toBeGreaterThan(
        inspector.calculateConfidence(plain)
      );
    });

    it('should cap at 1.0', () => {
      const big = Array.from({ length: 50 }, () => ({ value: '€7.18' }));
      expect(inspector.calculateConfidence(big)).toBeLessThanOrEqual(1);
    });
  });
});
