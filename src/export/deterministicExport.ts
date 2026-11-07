/**
 * Deterministic Export - Exports with metadata for reproducibility
 * Provides consistent output format with schema version, hashes, and FX source info
 */

import * as z from 'zod';

import { md5Hex } from '../data/md5Hex';
import { compareCodeUnits } from '../utils/compareCodeUnits';

export const ExportMetadataSchema = z.object({
  appVersion: z.string().trim().optional(),
  columnOrder: z.array(z.string().trim()),
  contentHash: z.string().trim(),
  exportedAt: z.iso.datetime(),
  exportFormat: z.enum(['csv', 'json', 'parquet']),
  fxSource: z
    .object({
      fallback: z.boolean().optional(),
      fetchedAt: z.iso.datetime().optional(),
      hash: z.string().trim().optional(),
      provider: z.string().trim().optional()
    })
    .optional(),
  profile: z.enum(['full', 'lite', 'ts-only']).optional(),
  recordCount: z.int().nonnegative(),
  schemaVersion: z.string().trim(),
  sourceFiles: z.array(
    z.object({
      hash: z.string().trim().optional(),
      importedAt: z.iso.datetime().optional(),
      name: z.string().trim(),
      structureHash: z.string().trim().optional()
    })
  )
});

export type ExportMetadata = z.infer<typeof ExportMetadataSchema>;

export interface ExportOptions {
  columnOrder?: string[];
  decimalSeparator?: ',' | '.';
  format: 'csv' | 'json';
  fxSource?: ExportMetadata['fxSource'];
  includeMetadata?: boolean;
  locale?: string;
  schemaVersion?: string;
}

const APP_VERSION = '1.0.0';
const SCHEMA_VERSION = '1.0.0';

export function compareExports(
  meta1: ExportMetadata,
  meta2: ExportMetadata
): { differences: string[]; identical: boolean } {
  const differences: string[] = [];

  if (meta1.contentHash !== meta2.contentHash) {
    differences.push('Content hash differs');
  }
  if (meta1.recordCount !== meta2.recordCount) {
    differences.push(`Record count: ${meta1.recordCount} vs ${meta2.recordCount}`);
  }
  if (meta1.schemaVersion !== meta2.schemaVersion) {
    differences.push(`Schema version: ${meta1.schemaVersion} vs ${meta2.schemaVersion}`);
  }
  if (JSON.stringify(meta1.columnOrder) !== JSON.stringify(meta2.columnOrder)) {
    differences.push('Column order differs');
  }

  return { differences, identical: differences.length === 0 };
}

export function downloadExport(
  data: Record<string, unknown>[],
  options: ExportOptions,
  sourceFiles: ExportMetadata['sourceFiles'] = []
): ExportMetadata {
  const { blob, filename, metadata } = exportData(data, options, sourceFiles);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  // Also download metadata sidecar if JSON export with metadata
  if (options.format === 'csv' && options.includeMetadata) {
    const metaBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    const metaUrl = URL.createObjectURL(metaBlob);
    const metaLink = document.createElement('a');
    metaLink.href = metaUrl;
    metaLink.download = filename.replace('.csv', '.meta.json');
    document.body.append(metaLink);
    metaLink.click();
    metaLink.remove();
    URL.revokeObjectURL(metaUrl);
  }

  return metadata;
}

export function exportData(
  data: Record<string, unknown>[],
  options: ExportOptions,
  sourceFiles: ExportMetadata['sourceFiles'] = []
): { blob: Blob; content: string; filename: string; metadata: ExportMetadata } {
  let result: { content: string; metadata: ExportMetadata };

  switch (options.format) {
    case 'csv': {
      result = exportToCSV(data, options, sourceFiles);
      break;
    }
    case 'json': {
      result = exportToJSON(data, options, sourceFiles);
      break;
    }
    default: {
      throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  const mimeType = options.format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json';
  const blob = new Blob([result.content], { type: mimeType });
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-').slice(0, 19);
  const filename = `fm-export-${timestamp}.${options.format}`;

  return { ...result, blob, filename };
}

export function exportToCSV(
  data: Record<string, unknown>[],
  options: ExportOptions,
  sourceFiles: ExportMetadata['sourceFiles'] = []
): { content: string; metadata: ExportMetadata } {
  const columnOrder = getCanonicalColumnOrder(data, options.columnOrder);
  const locale = options.locale || 'en-US';
  const decimalSep = options.decimalSeparator || '.';

  // Build CSV content
  const lines: string[] = [];

  // Header row
  lines.push(columnOrder.map(escapeCSVField).join(','));

  // Data rows - sorted by uid for determinism
  const sortedData = [...data].sort((a, b) => {
    const aUid = String(a.uid || '');
    const bUid = String(b.uid || '');
    return aUid.localeCompare(bUid);
  });

  for (const record of sortedData) {
    const row = columnOrder.map((col) => {
      const value = record[col];
      return escapeCSVField(formatValue(value, locale, decimalSep));
    });
    lines.push(row.join(','));
  }

  const content = lines.join('\n');
  const contentHash = computeContentHash(content);

  const metadata: ExportMetadata = {
    appVersion: APP_VERSION,
    columnOrder,
    contentHash,
    exportedAt: new Date().toISOString(),
    exportFormat: 'csv',
    fxSource: options.fxSource,
    profile: (window as any).FM_PROFILE?.profile,
    recordCount: data.length,
    schemaVersion: options.schemaVersion || SCHEMA_VERSION,
    sourceFiles
  };

  return { content, metadata };
}

export function exportToJSON(
  data: Record<string, unknown>[],
  options: ExportOptions,
  sourceFiles: ExportMetadata['sourceFiles'] = []
): { content: string; metadata: ExportMetadata } {
  const columnOrder = getCanonicalColumnOrder(data, options.columnOrder);

  // Sort data by uid for determinism
  const sortedData = [...data].sort((a, b) => {
    const aUid = String(a.uid || '');
    const bUid = String(b.uid || '');
    return aUid.localeCompare(bUid);
  });

  // Normalize each record to have consistent key order
  const normalizedData = sortedData.map((record) => {
    const normalized: Record<string, unknown> = {};
    for (const col of columnOrder) {
      if (col in record) {
        normalized[col] = record[col];
      }
    }
    return normalized;
  });

  const metadata: ExportMetadata = {
    appVersion: APP_VERSION,
    columnOrder,
    contentHash: '', // Will be set after content generation
    exportedAt: new Date().toISOString(),
    exportFormat: 'json',
    fxSource: options.fxSource,
    profile: (window as any).FM_PROFILE?.profile,
    recordCount: data.length,
    schemaVersion: options.schemaVersion || SCHEMA_VERSION,
    sourceFiles
  };

  const exportObject = options.includeMetadata
    ? { data: normalizedData, metadata: sortObjectKeys(metadata) }
    : { data: normalizedData };

  const content = JSON.stringify(exportObject, null, 2);
  metadata.contentHash = computeContentHash(content);

  // Update content if metadata was included
  if (options.includeMetadata) {
    const finalExport = { data: normalizedData, metadata: sortObjectKeys(metadata) };
    return { content: JSON.stringify(finalExport, null, 2), metadata };
  }

  return { content, metadata };
}

export function validateExportMetadata(data: unknown): ExportMetadata | null {
  const result = ExportMetadataSchema.safeParse(data);
  return result.success ? result.data : null;
}

function computeContentHash(data: string): string {
  return `md5-${md5Hex(data)}`;
}

function escapeCSVField(field: string): string {
  if (field.includes('"') || field.includes(',') || field.includes('\n') || field.includes('\r')) {
    return `"${field.replaceAll('"', '""')}"`;
  }
  return field;
}

function formatValue(value: unknown, locale: string, decimalSep: string): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    // Always use dot internally, replace if needed
    const str = value.toString();
    return decimalSep === ',' ? str.replace('.', ',') : str;
  }
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getCanonicalColumnOrder(
  data: Record<string, unknown>[],
  customOrder?: string[]
): string[] {
  if (customOrder && customOrder.length > 0) {
    return customOrder;
  }

  // Get all unique keys from all records
  const allKeys = new Set<string>();
  for (const record of data) {
    Object.keys(record).forEach((key) => allKeys.add(key));
  }

  // Canonical order: uid first, then name, then sorted alphabetically
  const keys = [...allKeys];
  const priority = ['uid', 'name', 'club', 'league', 'position', 'age'];

  return keys.sort((a, b) => {
    const aIndex = priority.indexOf(a);
    const bIndex = priority.indexOf(b);

    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });
}

function sortObjectKeys<T extends Record<string, unknown>>(obj: T): T {
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj).toSorted(compareCodeUnits);
  for (const key of keys) {
    const value = obj[key];
    sorted[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? sortObjectKeys(value as Record<string, unknown>)
        : value;
  }
  return sorted as T;
}

// Export to window
if (typeof window !== 'undefined') {
  (window as any).deterministicExport = {
    compareExports,
    downloadExport,
    exportData,
    exportToCSV,
    exportToJSON,
    validateMetadata: validateExportMetadata
  };
}
