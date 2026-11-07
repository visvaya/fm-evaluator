/**
 * Tests for storage/db.ts (Dexie/IndexedDB layer)
 *
 * Uses fake-indexeddb to provide IndexedDB in jsdom.
 *
 * NOTE: db.ts exports a singleton Dexie instance. Calling clearAll()
 * deletes the database and closes it. We avoid clearAll() between tests
 * and instead use unique IDs to keep tests independent.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

import {
  addAudit,
  clearAll,
  createDbBackup,
  type FileMetadata,
  getDbHealth,
  listDbBackups,
  listFiles,
  loadLdcMappingsDb,
  loadLdcSettingsDb,
  loadSettings,
  loadUIStateDb,
  restoreDbBackup,
  saveFileMetadata,
  saveLdcMappingsDb,
  saveLdcSettingsDb,
  saveSettings,
  saveUIStateDb
} from './db';

describe('storage/db', () => {
  // ========================================================================
  // Settings (uses fixed key 'ui' – sequential tests)
  // ========================================================================
  describe('settings', () => {
    it('should save and load settings', async () => {
      await saveSettings({ minMins: 500, percentile: 90 });
      const loaded = await loadSettings();
      expect(loaded).toEqual({ minMins: 500, percentile: 90 });
    });

    it('should overwrite settings on re-save', async () => {
      await saveSettings({ theme: 'dark' });
      await saveSettings({ theme: 'light' });
      const loaded = await loadSettings();
      expect(loaded).toEqual({ theme: 'light' });
    });
  });

  // ========================================================================
  // Files
  // ========================================================================
  describe('files', () => {
    it('should save and list file metadata', async () => {
      const meta: FileMetadata = {
        id: 'test-hash-123',
        importedAt: Date.now(),
        name: 'test-file.html',
        size: 1024
      };
      await saveFileMetadata(meta);
      const files = await listFiles();
      const found = files.find((f) => f.id === 'test-hash-123');
      expect(found).toBeDefined();
      expect(found.name).toBe('test-file.html');
    });

    it('should handle multiple files', async () => {
      await saveFileMetadata({ id: 'multi-a', importedAt: Date.now(), name: 'a.html' });
      await saveFileMetadata({ id: 'multi-b', importedAt: Date.now(), name: 'b.html' });
      const files = await listFiles();
      const ids = files.map((f) => f.id);
      expect(ids).toContain('multi-a');
      expect(ids).toContain('multi-b');
    });

    it('should overwrite file with same id (upsert)', async () => {
      await saveFileMetadata({ id: 'upsert-dup', importedAt: 1000, name: 'old.html' });
      await saveFileMetadata({ id: 'upsert-dup', importedAt: 2000, name: 'new.html' });
      const files = await listFiles();
      const found = files.filter((f) => f.id === 'upsert-dup');
      expect(found).toHaveLength(1);
      expect(found[0].name).toBe('new.html');
    });
  });

  // ========================================================================
  // Audit
  // ========================================================================
  describe('audit', () => {
    it('should add audit entries', async () => {
      const before = await getDbHealth();
      const auditBefore = before.tables.audit;

      await addAudit('Test audit entry', { test: true }, 'info');

      const after = await getDbHealth();
      expect(after.tables.audit).toBe(auditBefore + 1);
    });

    it('should track last audit timestamp', async () => {
      await addAudit('timestamp test');
      const health = await getDbHealth();
      expect(health.lastAudit).toBeDefined();
      expect(typeof health.lastAudit).toBe('number');
      expect(health.lastAudit).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // UI State
  // ========================================================================
  describe('uiState', () => {
    it('should save and load UI state', async () => {
      const state = { hiddenColumns: ['basic_dob'], pinnedColumns: ['basic_name'] };
      await saveUIStateDb(state);
      const loaded = await loadUIStateDb();
      expect(loaded).toEqual(state);
    });

    it('should overwrite UI state on re-save', async () => {
      await saveUIStateDb({ version: 1 });
      await saveUIStateDb({ version: 2 });
      const loaded = await loadUIStateDb();
      expect(loaded).toEqual({ version: 2 });
    });
  });

  // ========================================================================
  // LDC Settings
  // ========================================================================
  describe('ldcSettings', () => {
    it('should save and load LDC settings', async () => {
      const settings = { alpha: 0.5, enabled: true, model: 'powerLaw' };
      await saveLdcSettingsDb(settings);
      const loaded = await loadLdcSettingsDb();
      expect(loaded).toEqual(settings);
    });
  });

  // ========================================================================
  // LDC Mappings
  // ========================================================================
  describe('ldcMappings', () => {
    it('should save and load LDC mappings', async () => {
      const mappings = { 'PKO BP Ekstraklasa': 'POL1' };
      await saveLdcMappingsDb(mappings);
      const loaded = await loadLdcMappingsDb();
      expect(loaded).toEqual(mappings);
    });
  });

  // ========================================================================
  // Health Report
  // ========================================================================
  describe('getDbHealth', () => {
    it('should return health report with version and table counts', async () => {
      const health = await getDbHealth();
      expect(health.version).toBe(5);
      expect(health.tables).toHaveProperty('settings');
      expect(health.tables).toHaveProperty('files');
      expect(health.tables).toHaveProperty('audit');
      expect(health.tables).toHaveProperty('uiState');
      expect(health.tables).toHaveProperty('ldcSettings');
      expect(health.tables).toHaveProperty('ldcMappings');
      expect(typeof health.backups).toBe('number');
    });

    it('should have counts reflecting saved data', async () => {
      const health = await getDbHealth();
      // We've saved settings, files, audit, uiState, ldcSettings, ldcMappings above
      expect(health.tables.settings).toBeGreaterThanOrEqual(1);
      expect(health.tables.files).toBeGreaterThanOrEqual(1);
      expect(health.tables.audit).toBeGreaterThanOrEqual(1);
    });
  });

  // ========================================================================
  // Backup & Restore
  // ========================================================================
  describe('backup & restore', () => {
    it('should create a backup with label', async () => {
      const backup = await createDbBackup('test-backup');
      expect(backup.id).toBeDefined();
      expect(backup.label).toBe('test-backup');
      expect(typeof backup.payload).toBe('string');
      expect(backup.payload.length).toBeGreaterThan(0);
    });

    it('should list backups in reverse chronological order', async () => {
      await createDbBackup('list-1');
      await createDbBackup('list-2');

      const backups = await listDbBackups(10);
      expect(backups.length).toBeGreaterThanOrEqual(2);
      // Most recent first
      const labels = backups.map((b) => b.label);
      const idx1 = labels.indexOf('list-1');
      const idx2 = labels.indexOf('list-2');
      if (idx1 !== -1 && idx2 !== -1) {
        expect(idx2).toBeLessThan(idx1); // list-2 (newer) appears first
      }
    });

    it('should limit backup list', async () => {
      // Create enough backups
      for (let i = 0; i < 3; i++) {
        await createDbBackup(`limit-${i}`);
      }
      const limited = await listDbBackups(2);
      expect(limited.length).toBeLessThanOrEqual(2);
    });

    it('should restore data from backup', async () => {
      // Save known state
      await saveSettings({ restoreTest: 'original' });

      // Create backup
      const backup = await createDbBackup('restore-test');

      // Modify state
      await saveSettings({ restoreTest: 'modified' });
      const beforeRestore = await loadSettings();
      expect(beforeRestore).toEqual({ restoreTest: 'modified' });

      // Restore
      await restoreDbBackup(backup);

      // Verify original state restored
      const afterRestore = await loadSettings();
      expect(afterRestore).toEqual({ restoreTest: 'original' });
    });

    it('should throw on invalid backup payload', async () => {
      const badBackup = {
        createdAt: Date.now(),
        id: 999,
        payload: btoa('{"invalid": "no version field"}')
      };
      await expect(restoreDbBackup(badBackup as any)).rejects.toThrow();
    });
  });

  // ========================================================================
  // clearAll (last – deletes database, no tests should follow)
  // ========================================================================
  describe('clearAll', () => {
    it('should delete the database without throwing', async () => {
      // Verify data exists before clearing
      const healthBefore = await getDbHealth();
      expect(healthBefore.tables.settings).toBeGreaterThanOrEqual(1);

      // clearAll calls db.delete() which closes the singleton.
      // In a real browser Dexie auto-reopens, but fake-indexeddb
      // doesn't support that. We just verify it doesn't throw.
      await expect(clearAll()).resolves.not.toThrow();
    });
  });
});
