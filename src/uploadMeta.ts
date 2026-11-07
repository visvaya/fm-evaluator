import { getStructureHashCache } from './cache/structureHashCache';
import { addAudit, type FileMetadata, listFiles, saveFileMetadata } from './storage/db';

export interface DuplicateCheckResult {
  cacheHit?: boolean;
  contentHash?: string;
  existingFile?: FileMetadata;
  isDuplicate: boolean;
  reason?: 'content_hash' | 'name' | 'structure_hash';
}

interface FileMetaHelper {
  checkDuplicate: (file: File, structureHash?: string) => Promise<DuplicateCheckResult>;
  clearFileRecord: (fileId: string) => Promise<void>;
  getCachedStructureHash: (headers: string[]) => null | string;
  getImportedFiles: () => Promise<FileMetadata[]>;
  isDuplicate: (file: File) => Promise<boolean>;
  recordFile: (file: File, structureHash?: string, headers?: string[]) => Promise<void>;
}

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

let hashUnavailableLogged = false;

export function createFileMetaHelper(): FileMetaHelper {
  let cache: Map<string, FileMetadata> | null = null;
  let structureHashIndex: Map<string, FileMetadata> | null = null;

  const ensureCache = async () => {
    if (cache && structureHashIndex) return { cache, structureHashIndex };
    cache = new Map();
    structureHashIndex = new Map();
    try {
      const files = await listFiles();
      files.forEach((f) => {
        cache.set(f.id, f);
        if (f.structureHash) {
          structureHashIndex.set(f.structureHash, f);
        }
      });
    } catch (error) {
      console.warn('[FileMeta] Failed to load cache', error);
    }
    return { cache, structureHashIndex };
  };

  const isDuplicate = async (file: File): Promise<boolean> => {
    const h = await hashFile(file);
    if (!h) return false;
    const { cache: c } = await ensureCache();
    return c.has(h);
  };

  const checkDuplicate = async (
    file: File,
    structureHash?: string
  ): Promise<DuplicateCheckResult> => {
    const contentHash = await hashFile(file);
    const { cache: c, structureHashIndex: shi } = await ensureCache();

    if (contentHash && c.has(contentHash)) {
      return {
        contentHash,
        existingFile: c.get(contentHash),
        isDuplicate: true,
        reason: 'content_hash'
      };
    }

    if (structureHash && shi.has(structureHash)) {
      return {
        contentHash: contentHash ?? undefined,
        existingFile: shi.get(structureHash),
        isDuplicate: true,
        reason: 'structure_hash'
      };
    }

    return { contentHash: contentHash ?? undefined, isDuplicate: false };
  };

  const recordFile = async (file: File, structureHash?: string, headers?: string[]) => {
    const h = await hashFile(file);
    if (!h) return;
    const { cache: c, structureHashIndex: shi } = await ensureCache();
    const meta: FileMetadata = {
      id: h,
      importedAt: Date.now(),
      name: file.name,
      size: file.size,
      structureHash
    };
    c.set(h, meta);
    if (structureHash) {
      shi.set(structureHash, meta);
      // Also store in structure hash cache for faster lookups
      if (headers && headers.length > 0) {
        try {
          const hashCache = getStructureHashCache();
          hashCache.set(headers, structureHash);
        } catch (error) {
          console.warn('[FileMeta] Failed to cache structure hash:', error);
        }
      }
    }
    await saveFileMetadata(meta);
    await addAudit(
      'file_imported',
      { hash: h, name: file.name, size: file.size, structureHash },
      'info'
    );
  };

  const getImportedFiles = async (): Promise<FileMetadata[]> => {
    const { cache: c } = await ensureCache();
    return [...c.values()];
  };

  const clearFileRecord = async (fileId: string): Promise<void> => {
    const { cache: c, structureHashIndex: shi } = await ensureCache();
    const existing = c.get(fileId);
    if (existing) {
      c.delete(fileId);
      if (existing.structureHash) {
        shi.delete(existing.structureHash);
      }
      await addAudit('file_record_cleared', { id: fileId, name: existing.name }, 'info');
    }
  };

  const getCachedStructureHash = (headers: string[]): null | string => {
    try {
      const hashCache = getStructureHashCache();
      const entry = hashCache.get(headers);
      return entry ? entry.hash : null;
    } catch {
      return null;
    }
  };

  return {
    checkDuplicate,
    clearFileRecord,
    getCachedStructureHash,
    getImportedFiles,
    isDuplicate,
    recordFile
  };
}

async function hashFile(file: File): Promise<null | string> {
  if (!crypto.subtle?.digest) {
    if (!hashUnavailableLogged) {
      console.warn('[FileMeta] SubtleCrypto unavailable, skipping content hash dedup');
      hashUnavailableLogged = true;
    }
    return null;
  }
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return `sha256-${toBase64(digest)}`;
}
