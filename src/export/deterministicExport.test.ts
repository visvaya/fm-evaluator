// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { md5Hex } from '../data/md5Hex';

import {
  compareExports,
  exportData,
  type ExportMetadata,
  exportToCSV,
  exportToJSON,
  validateExportMetadata
} from './deterministicExport';

describe('deterministicExport', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      ...window,
      FM_PROFILE: undefined
    });
  });

  const sampleData: Record<string, unknown>[] = [
    { age: 25, club: 'City', name: 'Bob', uid: '002' },
    { age: 22, club: 'United', name: 'Alice', uid: '001' }
  ];

  describe('exportToCSV', () => {
    it('stamps the MD5 of the CSV content as contentHash', () => {
      const { content, metadata } = exportToCSV(sampleData, { format: 'csv' });
      expect(metadata.contentHash).toBe(`md5-${md5Hex(content)}`);
    });

    it('should produce CSV with header row and data rows', () => {
      const { content } = exportToCSV(sampleData, { format: 'csv' });
      const lines = content.split('\n');
      expect(lines).toHaveLength(3); // header + 2 data rows
    });

    it('should sort data by uid for determinism', () => {
      const { content } = exportToCSV(sampleData, { format: 'csv' });
      const lines = content.split('\n');
      // uid=001 (Alice) should come before uid=002 (Bob)
      expect(lines[1]).toContain('Alice');
      expect(lines[2]).toContain('Bob');
    });

    it('should use canonical column order (uid first, then name, then club)', () => {
      const { content } = exportToCSV(sampleData, { format: 'csv' });
      const header = content.split('\n')[0];
      const cols = header.split(',');
      expect(cols.indexOf('uid')).toBeLessThan(cols.indexOf('name'));
      expect(cols.indexOf('name')).toBeLessThan(cols.indexOf('club'));
    });

    it('should respect custom columnOrder', () => {
      const { content } = exportToCSV(sampleData, {
        columnOrder: ['name', 'age'],
        format: 'csv'
      });
      const header = content.split('\n')[0];
      expect(header).toBe('name,age');
    });

    it('should generate metadata with recordCount', () => {
      const { metadata } = exportToCSV(sampleData, { format: 'csv' });
      expect(metadata.recordCount).toBe(2);
      expect(metadata.exportFormat).toBe('csv');
      expect(metadata.contentHash).toBeTruthy();
    });

    it('should use comma decimal separator when specified', () => {
      const data = [{ uid: '1', value: 3.14 }];
      const { content } = exportToCSV(data, {
        decimalSeparator: ',',
        format: 'csv'
      });
      expect(content).toContain('3,14');
    });

    it('should escape CSV fields with commas', () => {
      const data = [{ name: 'Jones, Tom', uid: '1' }];
      const { content } = exportToCSV(data, {
        columnOrder: ['uid', 'name'],
        format: 'csv'
      });
      expect(content).toContain('"Jones, Tom"');
    });

    it('should escape double quotes in CSV', () => {
      const data = [{ note: 'He said "hello"', uid: '1' }];
      const { content } = exportToCSV(data, {
        columnOrder: ['uid', 'note'],
        format: 'csv'
      });
      expect(content).toContain('"He said ""hello"""');
    });

    it('should handle null/undefined values as empty strings', () => {
      const data = [{ club: undefined, name: null, uid: '1' }];
      const { content } = exportToCSV(data, {
        columnOrder: ['uid', 'name', 'club'],
        format: 'csv'
      });
      const row = content.split('\n')[1];
      expect(row).toBe('1,,');
    });

    it('should format boolean as 1/0', () => {
      const data = [{ active: true, retired: false, uid: '1' }];
      const { content } = exportToCSV(data, {
        columnOrder: ['uid', 'active', 'retired'],
        format: 'csv'
      });
      expect(content.split('\n')[1]).toBe('1,1,0');
    });
  });

  describe('exportToJSON', () => {
    it('should produce valid JSON', () => {
      const { content } = exportToJSON(sampleData, { format: 'json' });
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should sort data by uid for determinism', () => {
      const { content } = exportToJSON(sampleData, { format: 'json' });
      const parsed = JSON.parse(content);
      expect(parsed.data[0].uid).toBe('001');
      expect(parsed.data[1].uid).toBe('002');
    });

    it('should include metadata when includeMetadata is true', () => {
      const { content } = exportToJSON(sampleData, {
        format: 'json',
        includeMetadata: true
      });
      const parsed = JSON.parse(content);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.metadata.recordCount).toBe(2);
    });

    it('should not include metadata by default', () => {
      const { content } = exportToJSON(sampleData, { format: 'json' });
      const parsed = JSON.parse(content);
      expect(parsed.metadata).toBeUndefined();
    });

    it('should normalize records to only include canonical columns', () => {
      const { content } = exportToJSON(sampleData, {
        columnOrder: ['uid', 'name'],
        format: 'json'
      });
      const parsed = JSON.parse(content);
      expect(Object.keys(parsed.data[0])).toEqual(['uid', 'name']);
    });
  });

  describe('exportData', () => {
    it('should return blob and filename for csv', () => {
      const result = exportData(sampleData, { format: 'csv' });
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.filename).toMatch(/^fm-export-.*\.csv$/);
    });

    it('should return blob and filename for json', () => {
      const result = exportData(sampleData, { format: 'json' });
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.filename).toMatch(/^fm-export-.*\.json$/);
    });

    it('should throw for unsupported format', () => {
      expect(() => exportData(sampleData, { format: 'parquet' as any })).toThrow(
        'Unsupported export format'
      );
    });
  });

  describe('validateExportMetadata', () => {
    it('should validate correct metadata', () => {
      const meta: ExportMetadata = {
        columnOrder: ['uid', 'name'],
        contentHash: 'simple-abc123',
        exportedAt: new Date().toISOString(),
        exportFormat: 'csv',
        recordCount: 10,
        schemaVersion: '1.0.0',
        sourceFiles: []
      };
      expect(validateExportMetadata(meta)).not.toBeNull();
    });

    it('should return null for invalid metadata', () => {
      expect(validateExportMetadata({ foo: 'bar' })).toBeNull();
    });

    it('should return null for missing required fields', () => {
      expect(validateExportMetadata({ schemaVersion: '1.0.0' })).toBeNull();
    });
  });

  describe('compareExports', () => {
    const base: ExportMetadata = {
      columnOrder: ['uid', 'name'],
      contentHash: 'hash-123',
      exportedAt: new Date().toISOString(),
      exportFormat: 'csv',
      recordCount: 10,
      schemaVersion: '1.0.0',
      sourceFiles: []
    };

    it('should report identical for same metadata', () => {
      const result = compareExports(base, { ...base });
      expect(result.identical).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should detect content hash difference', () => {
      const other = { ...base, contentHash: 'hash-456' };
      const result = compareExports(base, other);
      expect(result.identical).toBe(false);
      expect(result.differences).toContain('Content hash differs');
    });

    it('should detect record count difference', () => {
      const other = { ...base, recordCount: 20 };
      const result = compareExports(base, other);
      expect(result.differences.some((d) => d.includes('Record count'))).toBe(true);
    });

    it('should detect schema version difference', () => {
      const other = { ...base, schemaVersion: '2.0.0' };
      const result = compareExports(base, other);
      expect(result.differences.some((d) => d.includes('Schema version'))).toBe(true);
    });

    it('should detect column order difference', () => {
      const other = { ...base, columnOrder: ['name', 'uid'] };
      const result = compareExports(base, other);
      expect(result.differences).toContain('Column order differs');
    });
  });
});
