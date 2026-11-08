import { IMPORT_LIMITS } from '@/config/importLimits';

/** Reads the text of an imported table cell, cut to the cell limit. */
export function readImportedCellText(cell: Node): string {
  return (cell.textContent ?? '').trim().slice(0, IMPORT_LIMITS.cellTextLengthChars).trimEnd();
}
