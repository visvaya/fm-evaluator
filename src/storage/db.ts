import Dexie, { type Table } from 'dexie';

export interface AuditEntry {
  context?: any;
  createdAt: number;
  id?: number;
  level?: 'error' | 'info' | 'warn';
  message: string;
}

export interface BackupRecord {
  createdAt: number;
  id?: number;
  label?: string;
  payload: string; // base64
}

export interface DbHealthReport {
  backups: number;
  lastAudit?: number;
  tables: Record<string, number>;
  version: number;
}

export interface FileMetadata {
  id: string; // content hash or structure hash
  importedAt: number;
  name: string;
  size?: number;
  structureHash?: string;
}

export interface LdcMappingsRecord {
  id: string;
  mappings: any;
  updatedAt: number;
}

export interface LdcSettingsRecord {
  data: any;
  id: string;
  updatedAt: number;
}

export interface SettingsRecord {
  data: any;
  id: string;
  updatedAt: number;
}

export interface UIStateRecord {
  data: any;
  id: string;
  updatedAt: number;
}

interface BackupSnapshot {
  createdAt: number;
  tables: {
    audit: AuditEntry[];
    files: FileMetadata[];
    ldcMappings: LdcMappingsRecord[];
    ldcSettings: LdcSettingsRecord[];
    settings: SettingsRecord[];
    uiState: UIStateRecord[];
  };
  version: number;
}

type PrimitiveMap = Record<string, any>;

const DB_NAME = 'fm-evaluator';
const DB_VERSION = 5;
const BROADCAST_CHANNEL = 'fm-evaluator-dexie';
const broadcastChannel =
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(BROADCAST_CHANNEL);

class AppDatabase extends Dexie {
  audit!: Table<AuditEntry, number>;
  backups!: Table<BackupRecord, number>;
  files!: Table<FileMetadata, string>;
  ldcMappings!: Table<LdcMappingsRecord, string>;
  ldcSettings!: Table<LdcSettingsRecord, string>;
  settings!: Table<SettingsRecord, string>;
  uiState!: Table<UIStateRecord, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      settings: 'id'
    });
    this.version(2).stores({
      audit: '++id, createdAt',
      files: 'id',
      settings: 'id'
    });
    this.version(3).stores({
      audit: '++id, createdAt',
      files: 'id',
      settings: 'id',
      uiState: 'id'
    });
    this.version(4).stores({
      audit: '++id, createdAt',
      files: 'id',
      ldcMappings: 'id',
      ldcSettings: 'id',
      settings: 'id',
      uiState: 'id'
    });
    this.version(5).stores({
      audit: '++id, createdAt',
      backups: '++id, createdAt',
      files: 'id',
      ldcMappings: 'id',
      ldcSettings: 'id',
      settings: 'id',
      uiState: 'id'
    });
  }
}

function decodePayload<T>(encoded: string): T {
  const json =
    typeof atob === 'function'
      ? decodeURIComponent(escape(atob(encoded)))
      : Buffer.from(encoded, 'base64').toString('utf-8');
  return JSON.parse(json) as T;
}

function emitDbEvent(event: string, payload?: PrimitiveMap) {
  if (!broadcastChannel) return;
  broadcastChannel.postMessage({ at: Date.now(), event, payload, source: 'dexie' });
}

function encodePayload(input: object): string {
  const json = JSON.stringify(input);
  return typeof btoa === 'function'
    ? btoa(unescape(encodeURIComponent(json)))
    : Buffer.from(json, 'utf-8').toString('base64');
}

const db = new AppDatabase();

export async function addAudit(
  message: string,
  context?: any,
  level: 'error' | 'info' | 'warn' = 'info'
) {
  await db.audit.add({ context, createdAt: Date.now(), level, message });
  emitDbEvent('audit.added');
}

export async function clearAll() {
  await db.delete();
  emitDbEvent('db.cleared');
}

export async function createDbBackup(label?: string): Promise<BackupRecord> {
  const snapshot: BackupSnapshot = {
    createdAt: Date.now(),
    tables: {
      audit: await db.audit.toArray(),
      files: await db.files.toArray(),
      ldcMappings: await db.ldcMappings.toArray(),
      ldcSettings: await db.ldcSettings.toArray(),
      settings: await db.settings.toArray(),
      uiState: await db.uiState.toArray()
    },
    version: DB_VERSION
  };
  const payload = encodePayload(snapshot);
  const record: BackupRecord = { createdAt: snapshot.createdAt, label, payload };
  const id = await db.backups.add(record);
  const stored = { ...record, id };
  emitDbEvent('backup.created', { id, label });
  return stored;
}

export async function getDbHealth(): Promise<DbHealthReport> {
  const [
    settingsCount,
    filesCount,
    auditCount,
    uiStateCount,
    ldcSettingsCount,
    ldcMappingsCount,
    backupsCount
  ] = await Promise.all([
    db.settings.count(),
    db.files.count(),
    db.audit.count(),
    db.uiState.count(),
    db.ldcSettings.count(),
    db.ldcMappings.count(),
    db.backups?.count() ?? Promise.resolve(0)
  ]);
  const lastAudit = await db.audit.orderBy('createdAt').last();
  return {
    backups: backupsCount,
    lastAudit: lastAudit?.createdAt,
    tables: {
      audit: auditCount,
      files: filesCount,
      ldcMappings: ldcMappingsCount,
      ldcSettings: ldcSettingsCount,
      settings: settingsCount,
      uiState: uiStateCount
    },
    version: DB_VERSION
  };
}

export async function listDbBackups(limit = 5): Promise<BackupRecord[]> {
  if (!db.backups) return [];
  return db.backups.orderBy('createdAt').reverse().limit(limit).toArray();
}

export async function listFiles(): Promise<FileMetadata[]> {
  return db.files.toArray();
}

export async function loadLdcMappingsDb(): Promise<any | null> {
  if (!db.ldcMappings) return null;
  const record = await db.ldcMappings.get('mappings');
  return record ? record.mappings : null;
}

export async function loadLdcSettingsDb(): Promise<any | null> {
  if (!db.ldcSettings) return null;
  const record = await db.ldcSettings.get('ldc');
  return record ? record.data : null;
}

export async function loadSettings(): Promise<any | null> {
  const record = await db.settings.get('ui');
  return record ? record.data : null;
}

export async function loadUIStateDb(): Promise<any | null> {
  if (!db.uiState) return null;
  const record = await db.uiState.get('ui');
  return record ? record.data : null;
}

export async function restoreDbBackup(record: BackupRecord): Promise<void> {
  const snapshot = decodePayload<BackupSnapshot>(record.payload);
  if (!snapshot || typeof snapshot.version !== 'number') {
    throw new Error('Nieprawidłowa kopia zapasowa');
  }
  await (db as any).transaction(
    'rw',
    db.settings,
    db.files,
    db.audit,
    db.uiState,
    db.ldcSettings,
    db.ldcMappings,
    async () => {
      await Promise.all([
        db.settings.clear(),
        db.files.clear(),
        db.audit.clear(),
        db.uiState.clear(),
        db.ldcSettings.clear(),
        db.ldcMappings.clear()
      ]);
      await db.settings.bulkPut(snapshot.tables.settings);
      await db.files.bulkPut(snapshot.tables.files);
      await db.audit.bulkPut(snapshot.tables.audit);
      await db.uiState.bulkPut(snapshot.tables.uiState);
      await db.ldcSettings.bulkPut(snapshot.tables.ldcSettings);
      await db.ldcMappings.bulkPut(snapshot.tables.ldcMappings);
    }
  );
  emitDbEvent('backup.restored', { id: record.id });
}

export async function saveFileMetadata(meta: FileMetadata) {
  await db.files.put({ ...meta, importedAt: meta.importedAt ?? Date.now() });
  emitDbEvent('files.updated', { id: meta.id });
}

export async function saveLdcMappingsDb(mappings: any) {
  if (!db.ldcMappings) return;
  await db.ldcMappings.put({ id: 'mappings', mappings, updatedAt: Date.now() });
  emitDbEvent('ldc.mappings.updated');
}

// LDC settings/mappings
export async function saveLdcSettingsDb(data: any) {
  if (!db.ldcSettings) return;
  await db.ldcSettings.put({ data, id: 'ldc', updatedAt: Date.now() });
  emitDbEvent('ldc.settings.updated');
}

export async function saveSettings(data: any) {
  await db.settings.put({ data, id: 'ui', updatedAt: Date.now() });
  emitDbEvent('settings.updated');
}

export async function saveUIStateDb(data: any) {
  if (!db.uiState) return;
  await db.uiState.put({ data, id: 'ui', updatedAt: Date.now() });
  emitDbEvent('uiState.updated');
}

export function subscribeToDbEvents(
  handler: (payload: { at: number; event: string; payload?: PrimitiveMap }) => void
) {
  if (!broadcastChannel) return () => {};
  const listener = (event: MessageEvent) => {
    if (event.data?.source !== 'dexie') return;
    handler(event.data);
  };
  broadcastChannel.addEventListener('message', listener);
  return () => broadcastChannel.removeEventListener('message', listener);
}
