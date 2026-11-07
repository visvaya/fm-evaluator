// @vitest-environment jsdom
/**
 * Tests for SchemaRegistry
 *
 * SchemaRegistry is a legacy JS class that attaches to window.SchemaRegistry.
 * It defines internal column IDs, data types, categories, and legacy mappings.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import './schemaRegistry.js';

let registry: any;

beforeAll(() => {
  registry = new (window as any).SchemaRegistry();
});

describe('SchemaRegistry', () => {
  describe('get', () => {
    it('should return schema info for known IDs', () => {
      const name = registry.get('basic_name');
      expect(name).not.toBeNull();
      expect(name.id).toBe('basic_name');
      expect(name.type).toBe('string');
      expect(name.required).toBe(true);
      expect(name.category).toBe('basic');
    });

    it('should return null for unknown IDs', () => {
      expect(registry.get('nonexistent_column')).toBeNull();
    });

    it('should have correct types for different categories', () => {
      expect(registry.get('attribute_pace').type).toBe('attribute');
      expect(registry.get('statistic_goals').type).toBe('statistic');
      expect(registry.get('basic_wage').type).toBe('currency');
      expect(registry.get('basic_dob').type).toBe('date');
      expect(registry.get('basic_position').type).toBe('enum');
      expect(registry.get('basic_personality').type).toBe('string_pass_through');
    });

    it('should mark wage as supportsFrequency', () => {
      const wage = registry.get('basic_wage');
      expect(wage.supportsFrequency).toBe(true);
    });

    it('should mark currency fields as canBeNegative=false', () => {
      expect(registry.get('basic_transfer_value').canBeNegative).toBe(false);
      expect(registry.get('basic_wage').canBeNegative).toBe(false);
      expect(registry.get('basic_asking_price').canBeNegative).toBe(false);
    });
  });

  describe('has', () => {
    it('should return true for known IDs', () => {
      expect(registry.has('basic_name')).toBe(true);
      expect(registry.has('attribute_pace')).toBe(true);
      expect(registry.has('statistic_goals')).toBe(true);
    });

    it('should return false for unknown IDs', () => {
      expect(registry.has('foo_bar')).toBe(false);
    });
  });

  describe('getAllIds', () => {
    it('should return an array of all schema IDs', () => {
      const ids = registry.getAllIds();
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBeGreaterThan(50);
    });

    it('should include required fields', () => {
      const ids = registry.getAllIds();
      expect(ids).toContain('basic_name');
      expect(ids).toContain('basic_uid');
    });

    it('should include all category types', () => {
      const ids = registry.getAllIds();
      expect(ids.some((id: string) => id.startsWith('basic_'))).toBe(true);
      expect(ids.some((id: string) => id.startsWith('attribute_'))).toBe(true);
      expect(ids.some((id: string) => id.startsWith('statistic_'))).toBe(true);
    });
  });

  describe('getByCategory', () => {
    it('should return physical attributes', () => {
      const physical = registry.getByCategory('physical');
      expect(physical).toContain('attribute_pace');
      expect(physical).toContain('attribute_acceleration');
      expect(physical).toContain('attribute_stamina');
      expect(physical).toContain('attribute_strength');
    });

    it('should return mental attributes', () => {
      const mental = registry.getByCategory('mental');
      expect(mental).toContain('attribute_decisions');
      expect(mental).toContain('attribute_vision');
      expect(mental).toContain('attribute_work_rate');
      expect(mental).toContain('attribute_bravery');
    });

    it('should return technical attributes', () => {
      const technical = registry.getByCategory('technical');
      expect(technical).toContain('attribute_finishing');
      expect(technical).toContain('attribute_passing');
      expect(technical).toContain('attribute_dribbling');
    });

    it('should return goalkeeper attributes', () => {
      const gk = registry.getByCategory('goalkeeper');
      expect(gk).toContain('attribute_handling');
      expect(gk).toContain('attribute_reflexes');
      expect(gk).toContain('attribute_one_on_ones');
    });

    it('should return statistics', () => {
      const stats = registry.getByCategory('statistic');
      expect(stats).toContain('statistic_goals');
      expect(stats).toContain('statistic_assists');
      expect(stats).toContain('statistic_xg');
    });

    it('should return empty array for unknown category', () => {
      expect(registry.getByCategory('unknown_category')).toEqual([]);
    });

    it('should not overlap between categories', () => {
      const physical = new Set(registry.getByCategory('physical'));
      const mental = new Set(registry.getByCategory('mental'));
      const technical = new Set(registry.getByCategory('technical'));

      for (const id of physical) {
        expect(mental.has(id)).toBe(false);
        expect(technical.has(id)).toBe(false);
      }
    });
  });

  describe('getLegacyHeaderName', () => {
    it('should map basic fields', () => {
      expect(registry.getLegacyHeaderName('basic_name')).toBe('Name');
      expect(registry.getLegacyHeaderName('basic_uid')).toBe('UID');
      expect(registry.getLegacyHeaderName('basic_position')).toBe('Position');
      expect(registry.getLegacyHeaderName('basic_wage')).toBe('Wage');
      expect(registry.getLegacyHeaderName('basic_dob')).toBe('DoB');
    });

    it('should map physical attributes to abbreviations', () => {
      expect(registry.getLegacyHeaderName('attribute_pace')).toBe('Pac');
      expect(registry.getLegacyHeaderName('attribute_acceleration')).toBe('Acc');
      expect(registry.getLegacyHeaderName('attribute_stamina')).toBe('Sta');
      expect(registry.getLegacyHeaderName('attribute_strength')).toBe('Str');
    });

    it('should map mental attributes', () => {
      expect(registry.getLegacyHeaderName('attribute_decisions')).toBe('Dec');
      expect(registry.getLegacyHeaderName('attribute_vision')).toBe('Vis');
      expect(registry.getLegacyHeaderName('attribute_work_rate')).toBe('Wor');
    });

    it('should map statistics', () => {
      expect(registry.getLegacyHeaderName('statistic_goals')).toBe('Gls');
      expect(registry.getLegacyHeaderName('statistic_assists')).toBe('Ast');
      expect(registry.getLegacyHeaderName('statistic_xg')).toBe('xG');
    });

    it('should return null for unknown schema ID', () => {
      expect(registry.getLegacyHeaderName('unknown_field')).toBeNull();
    });
  });

  describe('getSchemaIdFromLegacy', () => {
    it('should reverse-map from legacy name to schema ID', () => {
      expect(registry.getSchemaIdFromLegacy('Name')).toBe('basic_name');
      expect(registry.getSchemaIdFromLegacy('UID')).toBe('basic_uid');
      expect(registry.getSchemaIdFromLegacy('Pac')).toBe('attribute_pace');
      expect(registry.getSchemaIdFromLegacy('Gls')).toBe('statistic_goals');
    });

    it('should return null for unknown legacy name', () => {
      expect(registry.getSchemaIdFromLegacy('NonExistent')).toBeNull();
    });

    it('should be consistent with getLegacyHeaderName (round-trip)', () => {
      const ids = registry.getAllIds();
      for (const id of ids) {
        const legacy = registry.getLegacyHeaderName(id);
        if (legacy) {
          expect(registry.getSchemaIdFromLegacy(legacy)).toBe(id);
        }
      }
    });
  });

  describe('schema integrity', () => {
    it('should have required fields marked as required', () => {
      expect(registry.get('basic_name').required).toBe(true);
      expect(registry.get('basic_uid').required).toBe(true);
    });

    it('should have optional fields marked as not required', () => {
      expect(registry.get('attribute_pace').required).toBe(false);
      expect(registry.get('statistic_goals').required).toBe(false);
      expect(registry.get('basic_club').required).toBe(false);
    });

    it('every schema entry should have id, type, and category', () => {
      const ids = registry.getAllIds();
      for (const id of ids) {
        const info = registry.get(id);
        expect(info.id).toBe(id);
        expect(typeof info.type).toBe('string');
        expect(typeof info.category).toBe('string');
      }
    });

    it('categoryIndex should cover all schema IDs', () => {
      const allIds = new Set(registry.getAllIds());
      const categories = ['basic', 'physical', 'mental', 'technical', 'goalkeeper', 'statistic'];
      const indexed = new Set<string>();
      for (const cat of categories) {
        for (const id of registry.getByCategory(cat)) {
          indexed.add(id);
        }
      }
      expect(indexed.size).toBe(allIds.size);
    });
  });
});
