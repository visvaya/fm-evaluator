import { describe, expect, it } from 'vitest';

import {
  formatMigrationChecklist,
  getAppliedMigrations,
  getMigrationChecklist,
  getMigrationInfo,
  getPendingMigrations,
  type MigrationChecklistItem,
  MIGRATIONS,
  validateMigrationSequence
} from './migrations';

describe('MIGRATIONS constant', () => {
  it('should have at least 5 migrations', () => {
    expect(MIGRATIONS.length).toBeGreaterThanOrEqual(5);
  });

  it('should have sequential version numbers', () => {
    for (let i = 1; i < MIGRATIONS.length; i++) {
      expect(MIGRATIONS[i].version).toBeGreaterThan(MIGRATIONS[i - 1].version);
    }
  });

  it('each migration should have a description', () => {
    for (const m of MIGRATIONS) {
      expect(m.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('each migration should have an up function', () => {
    for (const m of MIGRATIONS) {
      expect(typeof m.up).toBe('function');
    }
  });
});

describe('getMigrationChecklist', () => {
  it('should mark all as applied when current version >= max', () => {
    const checklist = getMigrationChecklist(100);
    for (const item of checklist) {
      expect(item.status).toBe('applied');
    }
  });

  it('should mark all as pending when current version is 0', () => {
    const checklist = getMigrationChecklist(0);
    for (const item of checklist) {
      expect(item.status).toBe('pending');
    }
  });

  it('should split applied/pending at boundary', () => {
    const checklist = getMigrationChecklist(3);
    const applied = checklist.filter((i) => i.status === 'applied');
    const pending = checklist.filter((i) => i.status === 'pending');
    expect(applied).toHaveLength(3);
    expect(pending).toHaveLength(MIGRATIONS.length - 3);
  });

  it('should include version and description from MIGRATIONS', () => {
    const checklist = getMigrationChecklist(5);
    expect(checklist[0].version).toBe(MIGRATIONS[0].version);
    expect(checklist[0].description).toBe(MIGRATIONS[0].description);
  });
});

describe('getPendingMigrations', () => {
  it('should return empty for version >= max', () => {
    expect(getPendingMigrations(100)).toHaveLength(0);
  });

  it('should return all for version 0', () => {
    expect(getPendingMigrations(0)).toHaveLength(MIGRATIONS.length);
  });

  it('should return only migrations after current version', () => {
    const pending = getPendingMigrations(3);
    for (const m of pending) {
      expect(m.version).toBeGreaterThan(3);
    }
  });
});

describe('getAppliedMigrations', () => {
  it('should return empty for version 0', () => {
    expect(getAppliedMigrations(0)).toHaveLength(0);
  });

  it('should return all for version >= max', () => {
    expect(getAppliedMigrations(100)).toHaveLength(MIGRATIONS.length);
  });

  it('should return only migrations up to current version', () => {
    const applied = getAppliedMigrations(3);
    expect(applied).toHaveLength(3);
    for (const m of applied) {
      expect(m.version).toBeLessThanOrEqual(3);
    }
  });
});

describe('validateMigrationSequence', () => {
  it('should return valid for actual MIGRATIONS', () => {
    const result = validateMigrationSequence();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('formatMigrationChecklist', () => {
  it('should include header line', () => {
    const checklist = getMigrationChecklist(5);
    const output = formatMigrationChecklist(checklist);
    expect(output).toContain('Dexie Migration Checklist');
  });

  it('should show applied items with checkmark', () => {
    const checklist: MigrationChecklistItem[] = [
      { description: 'Initial', status: 'applied', version: 1 }
    ];
    const output = formatMigrationChecklist(checklist);
    expect(output).toContain('[✓]');
  });

  it('should show pending items with empty box', () => {
    const checklist: MigrationChecklistItem[] = [
      { description: 'Pending', status: 'pending', version: 2 }
    ];
    const output = formatMigrationChecklist(checklist);
    expect(output).toContain('[ ]');
  });

  it('should show failed items with cross', () => {
    const checklist: MigrationChecklistItem[] = [
      { description: 'Failed', error: 'Boom', status: 'failed', version: 3 }
    ];
    const output = formatMigrationChecklist(checklist);
    expect(output).toContain('[✗]');
    expect(output).toContain('Boom');
  });

  it('should show rolled back items with arrow', () => {
    const checklist: MigrationChecklistItem[] = [
      { description: 'Rolled back', status: 'rolled_back', version: 4 }
    ];
    const output = formatMigrationChecklist(checklist);
    expect(output).toContain('[↩]');
  });

  it('should include timestamp when appliedAt is present', () => {
    const ts = 1700000000000;
    const checklist: MigrationChecklistItem[] = [
      { appliedAt: ts, description: 'Test', status: 'applied', version: 1 }
    ];
    const output = formatMigrationChecklist(checklist);
    expect(output).toContain(new Date(ts).toISOString());
  });
});

describe('getMigrationInfo', () => {
  it('should return correct latest version', () => {
    const info = getMigrationInfo();
    const maxVersion = Math.max(...MIGRATIONS.map((m) => m.version));
    expect(info.latestVersion).toBe(maxVersion);
  });

  it('should return correct total count', () => {
    expect(getMigrationInfo().totalMigrations).toBe(MIGRATIONS.length);
  });

  it('should count rollback support', () => {
    const info = getMigrationInfo();
    const withDown = MIGRATIONS.filter((m) => !!m.down).length;
    expect(info.hasRollbackSupport).toBe(withDown);
  });

  it('should list breaking migrations', () => {
    const info = getMigrationInfo();
    const breaking = MIGRATIONS.filter((m) => m.breaking).map((m) => m.version);
    expect(info.breakingMigrations).toEqual(breaking);
  });
});
