/**
 * Dexie Migration System with semver versioning and up/down checklist
 * Provides structured migration handling with rollback support
 */
import type Dexie from 'dexie';
import type { Table } from 'dexie';

export interface MigrationChecklistItem {
  appliedAt?: number;
  description: string;
  error?: string;
  status: 'applied' | 'failed' | 'pending' | 'rolled_back';
  version: number;
}

export interface MigrationResult {
  errors: string[];
  fromVersion: number;
  stepsApplied: number[];
  success: boolean;
  timestamp: number;
  toVersion: number;
}

export interface MigrationStep {
  breaking?: boolean;
  description: string;
  down?: (db: Dexie) => Promise<void>;
  up: (db: Dexie) => Promise<void>;
  version: number;
}

const MIGRATION_META_KEY = '__fm_migration_meta__';

export const MIGRATIONS: MigrationStep[] = [
  {
    description: 'Initial schema: settings table',
    up: async () => {
      // Handled by Dexie.version(1).stores()
    },
    version: 1
  },
  {
    description: 'Add files and audit tables for import tracking',
    up: async () => {
      // Handled by Dexie.version(2).stores()
    },
    version: 2
  },
  {
    description: 'Add uiState table for persisting UI preferences',
    up: async () => {
      // Handled by Dexie.version(3).stores()
    },
    version: 3
  },
  {
    description: 'Add LDC settings and mappings tables',
    up: async () => {
      // Handled by Dexie.version(4).stores()
    },
    version: 4
  },
  {
    description: 'Add backups table for database snapshots',
    up: async () => {
      // Handled by Dexie.version(5).stores()
    },
    version: 5
  },
  {
    description: 'Add structureHashCache table with TTL support',
    down: async (db) => {
      // Rollback: clear cache table if exists
      const table = db.table('structureHashCache');
      if (table) {
        await table.clear();
      }
    },
    up: async (db) => {
      // This will be applied when we bump DB_VERSION to 6
      // For now it's a placeholder for the next migration
    },
    version: 6
  }
];

export function formatMigrationChecklist(checklist: MigrationChecklistItem[]): string {
  const lines = ['=== Dexie Migration Checklist ==='];

  for (const item of checklist) {
    const statusIcon = {
      applied: '[✓]',
      failed: '[✗]',
      pending: '[ ]',
      rolled_back: '[↩]'
    }[item.status];

    const timestamp = item.appliedAt ? ` (${new Date(item.appliedAt).toISOString()})` : '';

    lines.push(`${statusIcon} v${item.version}: ${item.description}${timestamp}`);

    if (item.error) {
      lines.push(`    Error: ${item.error}`);
    }
  }

  return lines.join('\n');
}

export function getAppliedMigrations(currentVersion: number): MigrationStep[] {
  return MIGRATIONS.filter((m) => m.version <= currentVersion);
}

export function getMigrationChecklist(currentVersion: number): MigrationChecklistItem[] {
  return MIGRATIONS.map((m) => ({
    description: m.description,
    status: m.version <= currentVersion ? 'applied' : 'pending',
    version: m.version
  }));
}

/**
 * Dexie migration tooling. Unused today; kept until the React/TS migration decides its fate.
 * @public
 */
export async function getMigrationHistory(db: Dexie): Promise<MigrationResult[]> {
  try {
    const settingsTable = db.table('settings');
    if (!settingsTable) return [];

    const record = (await settingsTable.get(MIGRATION_META_KEY)) as any;
    return (record?.data as MigrationResult[]) || [];
  } catch {
    return [];
  }
}

// Export migration info for diagnostics
export function getMigrationInfo(): {
  breakingMigrations: number[];
  hasRollbackSupport: number;
  latestVersion: number;
  totalMigrations: number;
} {
  const latestVersion = Math.max(...MIGRATIONS.map((m) => m.version));
  const hasRollbackSupport = MIGRATIONS.filter((m) => !!m.down).length;
  const breakingMigrations = MIGRATIONS.filter((m) => m.breaking).map((m) => m.version);

  return {
    breakingMigrations,
    hasRollbackSupport,
    latestVersion,
    totalMigrations: MIGRATIONS.length
  };
}

export function getPendingMigrations(currentVersion: number): MigrationStep[] {
  return MIGRATIONS.filter((m) => m.version > currentVersion);
}

/**
 * Dexie migration tooling. Unused today; kept until the React/TS migration decides its fate.
 * @public
 */
export async function runMigrationDown(db: Dexie, targetVersion: number): Promise<MigrationResult> {
  const currentVersion = db.verno;
  const result: MigrationResult = {
    errors: [],
    fromVersion: currentVersion,
    stepsApplied: [],
    success: true,
    timestamp: Date.now(),
    toVersion: targetVersion
  };

  const toRollback = MIGRATIONS.filter(
    (m) => m.version <= currentVersion && m.version > targetVersion && m.down
  ).reverse();

  for (const migration of toRollback) {
    if (!migration.down) continue;

    try {
      await migration.down(db);
      result.stepsApplied.push(migration.version);
    } catch (error) {
      result.success = false;
      result.errors.push(
        `v${migration.version}: ${error instanceof Error ? error.message : String(error)}`
      );
      break;
    }
  }

  await saveMigrationMeta(db, result);
  return result;
}

/**
 * Dexie migration tooling. Unused today; kept until the React/TS migration decides its fate.
 * @public
 */
export async function runMigrationUp(db: Dexie, targetVersion: number): Promise<MigrationResult> {
  const currentVersion = db.verno;
  const result: MigrationResult = {
    errors: [],
    fromVersion: currentVersion,
    stepsApplied: [],
    success: true,
    timestamp: Date.now(),
    toVersion: targetVersion
  };

  const pending = MIGRATIONS.filter(
    (m) => m.version > currentVersion && m.version <= targetVersion
  );

  for (const migration of pending) {
    try {
      await migration.up(db);
      result.stepsApplied.push(migration.version);
    } catch (error) {
      result.success = false;
      result.errors.push(
        `v${migration.version}: ${error instanceof Error ? error.message : String(error)}`
      );
      break;
    }
  }

  await saveMigrationMeta(db, result);
  return result;
}

export async function saveMigrationMeta(db: Dexie, result: MigrationResult): Promise<void> {
  const settingsTable = db.table('settings');
  if (!settingsTable) return;

  try {
    const existing = (await settingsTable.get(MIGRATION_META_KEY)) as any;
    const history = (existing?.data as MigrationResult[]) || [];
    history.push(result);

    // Keep only last 10 migration records
    const trimmed = history.slice(-10);

    await settingsTable.put({
      data: trimmed,
      id: MIGRATION_META_KEY,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.warn('[Migrations] Failed to save migration meta:', error);
  }
}

export function validateMigrationSequence(): { errors: string[]; valid: boolean } {
  const errors: string[] = [];
  const versions = new Set<number>();

  for (let i = 0; i < MIGRATIONS.length; i++) {
    const migration = MIGRATIONS[i];

    // Check for duplicate versions
    if (versions.has(migration.version)) {
      errors.push(`Duplicate migration version: ${migration.version}`);
    }
    versions.add(migration.version);

    // Check for sequential order
    if (i > 0 && migration.version <= MIGRATIONS[i - 1].version) {
      errors.push(
        `Migration v${migration.version} is not in sequential order after v${MIGRATIONS[i - 1].version}`
      );
    }

    // Check for description
    if (!migration.description || migration.description.trim() === '') {
      errors.push(`Migration v${migration.version} has no description`);
    }
  }

  return { errors, valid: errors.length === 0 };
}
