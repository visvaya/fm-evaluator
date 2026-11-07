/**
 * Computes a stable structure hash for a set of column headers, used to
 * recognize a previously-seen file layout (format-verification skip,
 * duplicate-file detection). Exported as a plain function so callers do not
 * depend on window.computeStructureHash being registered by the async
 * runtime bootstrap (src/runtime.ts) before they run - that bootstrap is
 * loaded via a dynamic import() and can resolve after the UI already allows
 * a file upload, which previously caused an intermittent
 * "window.computeStructureHash is not a function" failure on fast uploads.
 */
import { md5Hex } from './md5Hex';

function compareByCodeUnit(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function computeStructureHash(headers: readonly string[]): string {
  // Plain code-unit ordering (not localeCompare) to exactly match the
  // previous Array#sort() behavior - existing structureHash_* localStorage
  // entries and duplicate-file checks depend on this hash staying stable.
  const sortedHeaders = [...headers].toSorted(compareByCodeUnit).join('|');
  return md5Hex(sortedHeaders);
}
