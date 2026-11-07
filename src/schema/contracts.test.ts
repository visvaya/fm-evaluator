import { describe, expect, it } from 'vitest';

import {
  checkLanguageSchemaConsistency,
  formatValidationErrors,
  validateAuditEntry,
  validateFileMetadata,
  validateImportResult,
  validateLanguageConfig,
  validatePlayerRecord,
  validatePlayerRecords,
  validateSchemaEntry,
  validateSchemaRegistry
} from './contracts';

describe('contracts', () => {
  // -----------------------------------------------------------------------
  // Schema Entry
  // -----------------------------------------------------------------------

  describe('validateSchemaEntry', () => {
    it('should accept valid schema entry', () => {
      const result = validateSchemaEntry({
        category: 'physical',
        id: 'Acceleration',
        required: false,
        type: 'attribute'
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing id', () => {
      const result = validateSchemaEntry({
        category: 'physical',
        required: false,
        type: 'attribute'
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid type', () => {
      const result = validateSchemaEntry({
        category: 'physical',
        id: 'test',
        required: false,
        type: 'invalid_type'
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid category', () => {
      const result = validateSchemaEntry({
        category: 'invalid_category',
        id: 'test',
        required: false,
        type: 'attribute'
      });
      expect(result.success).toBe(false);
    });

    it('should accept optional fields', () => {
      const result = validateSchemaEntry({
        canBeNegative: true,
        category: 'statistic',
        id: 'Goals',
        required: true,
        supportsFrequency: true,
        type: 'statistic'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.canBeNegative).toBe(true);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Schema Registry
  // -----------------------------------------------------------------------

  describe('validateSchemaRegistry', () => {
    it('should accept valid registry', () => {
      const result = validateSchemaRegistry({
        Acceleration: {
          category: 'physical',
          id: 'Acceleration',
          required: false,
          type: 'attribute'
        }
      });
      expect(result.success).toBe(true);
    });

    it('should reject registry with invalid entries', () => {
      const result = validateSchemaRegistry({
        bad: { id: 'bad' } // missing required fields
      });
      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Language Config
  // -----------------------------------------------------------------------

  describe('validateLanguageConfig', () => {
    it('should accept valid language config', () => {
      const result = validateLanguageConfig({
        headers: {
          Club: ['Club', 'Team'],
          Name: ['Name', 'Player Name']
        },
        id: 'english'
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing id', () => {
      const result = validateLanguageConfig({
        headers: { Name: ['Name'] }
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty id', () => {
      const result = validateLanguageConfig({
        headers: { Name: ['Name'] },
        id: ''
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing headers', () => {
      const result = validateLanguageConfig({ id: 'english' });
      expect(result.success).toBe(false);
    });

    it('should accept config with optional globalAnchors', () => {
      const result = validateLanguageConfig({
        globalAnchors: {
          physical: {
            Acceleration: {
              neighbors: ['Pace', 'Agility'],
              target: 'Acceleration'
            }
          }
        },
        headers: { Name: ['Name'] },
        id: 'english'
      });
      expect(result.success).toBe(true);
    });

    it('should accept config with valueTranslations', () => {
      const result = validateLanguageConfig({
        headers: { Name: ['Nazwa'] },
        id: 'polish',
        valueTranslations: {
          foot: { Lewy: 'Left', Prawy: 'Right' }
        }
      });
      expect(result.success).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // File Metadata
  // -----------------------------------------------------------------------

  describe('validateFileMetadata', () => {
    it('should accept valid metadata', () => {
      const result = validateFileMetadata({
        id: 'file-001',
        importedAt: Date.now(),
        name: 'export.html'
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty id', () => {
      const result = validateFileMetadata({
        id: '',
        importedAt: Date.now(),
        name: 'export.html'
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative importedAt', () => {
      const result = validateFileMetadata({
        id: 'file-001',
        importedAt: -1,
        name: 'export.html'
      });
      expect(result.success).toBe(false);
    });

    it('should accept optional fields', () => {
      const result = validateFileMetadata({
        id: 'file-001',
        importedAt: Date.now(),
        name: 'export.html',
        size: 1024,
        structureHash: 'abc123'
      });
      expect(result.success).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Audit Entry
  // -----------------------------------------------------------------------

  describe('validateAuditEntry', () => {
    it('should accept valid audit entry', () => {
      const result = validateAuditEntry({
        createdAt: Date.now(),
        level: 'info',
        message: 'File imported'
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty message', () => {
      const result = validateAuditEntry({
        createdAt: Date.now(),
        message: ''
      });
      expect(result.success).toBe(false);
    });

    it('should default level to info', () => {
      const result = validateAuditEntry({
        createdAt: Date.now(),
        message: 'test'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.level).toBe('info');
      }
    });
  });

  // -----------------------------------------------------------------------
  // Player Record
  // -----------------------------------------------------------------------

  describe('validatePlayerRecord', () => {
    it('should accept valid player', () => {
      const result = validatePlayerRecord({
        name: 'Jan Kowalski',
        uid: 'p001'
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing uid', () => {
      const result = validatePlayerRecord({ name: 'Test' });
      expect(result.success).toBe(false);
    });

    it('should reject missing name', () => {
      const result = validatePlayerRecord({ uid: 'p001' });
      expect(result.success).toBe(false);
    });

    it('should accept full player record', () => {
      const result = validatePlayerRecord({
        age: 25,
        attributes: { Acceleration: 15 },
        attrScore: 16,
        club: 'Test FC',
        importedAt: Date.now(),
        league: 'Premier League',
        name: 'Jan Kowalski',
        position: 'MC',
        sourceFile: 'export.html',
        statistics: { Goals: 10 },
        statScore: 14,
        totalScore: 15.5,
        uid: 'p001',
        value: 10000000,
        wage: 50000
      });
      expect(result.success).toBe(true);
    });

    it('should reject negative value', () => {
      const result = validatePlayerRecord({
        name: 'Test',
        uid: 'p001',
        value: -100
      });
      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Import Result
  // -----------------------------------------------------------------------

  describe('validateImportResult', () => {
    it('should accept valid import result', () => {
      const result = validateImportResult({
        fileId: 'f001',
        fileName: 'export.html',
        importedAt: Date.now(),
        recordCount: 50,
        success: true
      });
      expect(result.success).toBe(true);
    });

    it('should default warnings and errors to empty arrays', () => {
      const result = validateImportResult({
        fileId: 'f001',
        fileName: 'export.html',
        importedAt: Date.now(),
        recordCount: 0,
        success: true
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.warnings).toEqual([]);
        expect(result.data.errors).toEqual([]);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Batch validation
  // -----------------------------------------------------------------------

  describe('validatePlayerRecords', () => {
    it('should separate valid and invalid records', () => {
      const data = [
        { name: 'Valid Player', uid: 'p001' },
        { name: 'Invalid - empty uid', uid: '' },
        { name: 'Another Valid', uid: 'p003' }
      ];
      const { invalid, valid } = validatePlayerRecords(data);
      expect(valid).toHaveLength(2);
      expect(invalid).toHaveLength(1);
      expect(invalid[0].index).toBe(1);
    });

    it('should return all valid for correct data', () => {
      const data = [
        { name: 'Player 1', uid: 'p001' },
        { name: 'Player 2', uid: 'p002' }
      ];
      const { invalid, valid } = validatePlayerRecords(data);
      expect(valid).toHaveLength(2);
      expect(invalid).toHaveLength(0);
    });

    it('should handle empty array', () => {
      const { invalid, valid } = validatePlayerRecords([]);
      expect(valid).toHaveLength(0);
      expect(invalid).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Utility functions
  // -----------------------------------------------------------------------

  describe('formatValidationErrors', () => {
    it('should format zod errors into readable strings', () => {
      const result = validatePlayerRecord({ name: '', uid: '' });
      if (!result.success) {
        const formatted = formatValidationErrors((result as any).errors);
        expect(formatted.length).toBeGreaterThan(0);
        expect(formatted[0]).toContain(':');
      }
    });
  });

  describe('checkLanguageSchemaConsistency', () => {
    it('should find orphan headers not in schema', () => {
      const langConfig = {
        headers: {
          CustomField: ['Custom'],
          Name: ['Name']
        },
        id: 'test'
      };
      const schema = {
        Name: { category: 'basic' as const, id: 'Name', required: true, type: 'string' as const }
      };

      const { missingHeaders, orphanHeaders } = checkLanguageSchemaConsistency(langConfig, schema);
      expect(orphanHeaders).toContain('CustomField');
      expect(missingHeaders).toHaveLength(0);
    });

    it('should find missing headers in language config', () => {
      const langConfig = {
        headers: {
          Name: ['Name']
        },
        id: 'test'
      };
      const schema = {
        Club: { category: 'basic' as const, id: 'Club', required: false, type: 'string' as const },
        Name: { category: 'basic' as const, id: 'Name', required: true, type: 'string' as const }
      };

      const { missingHeaders, orphanHeaders } = checkLanguageSchemaConsistency(langConfig, schema);
      expect(orphanHeaders).toHaveLength(0);
      expect(missingHeaders).toContain('Club');
    });

    it('should return empty arrays for consistent config', () => {
      const langConfig = {
        headers: { Name: ['Name'] },
        id: 'test'
      };
      const schema = {
        Name: { category: 'basic' as const, id: 'Name', required: true, type: 'string' as const }
      };

      const { missingHeaders, orphanHeaders } = checkLanguageSchemaConsistency(langConfig, schema);
      expect(orphanHeaders).toHaveLength(0);
      expect(missingHeaders).toHaveLength(0);
    });
  });
});
