import { IMPORT_LIMITS } from '@/config/importLimits';

export interface ImportedCellText {
  text: string;
  wasCut: boolean;
}

/** How many cells of one column were cut to the cell limit. */
export interface CutCellCount {
  column: string;
  count: number;
}

export interface ImportedRows {
  cutCells: CutCellCount[];
  rows: (Record<number, string> & { index: number })[];
}

/** Reads the text of an imported table cell, cut to the cell limit. */
export function readImportedCellText(cell: Node): ImportedCellText {
  const text = (cell.textContent ?? '').trim();
  if (text.length <= IMPORT_LIMITS.cellTextLengthChars) {
    return { text, wasCut: false };
  }
  return { text: text.slice(0, IMPORT_LIMITS.cellTextLengthChars).trimEnd(), wasCut: true };
}

export interface FileWithCutCells {
  cutCells: CutCellCount[];
  name: string;
}

/** The file stack entries whose import cut cells, in stack order. */
export function filesWithCutCells(fileStack: readonly unknown[]): FileWithCutCells[] {
  return fileStack.filter(hasCutCells).map(({ cutCells, name }) => ({
    cutCells,
    name: typeof name === 'string' ? name : ''
  }));
}

function hasCutCells(file: unknown): file is { cutCells: CutCellCount[]; name?: unknown } {
  return (
    typeof file === 'object' &&
    file !== null &&
    'cutCells' in file &&
    Array.isArray(file.cutCells) &&
    file.cutCells.length > 0
  );
}

/** Lists cut cell counts for a notice, as "Notes (2), Name (1)". */
export function formatCutCellColumns(cutCells: readonly CutCellCount[]): string {
  return cutCells.map(({ column, count }) => `${column} (${count})`).join(', ');
}

/**
 * Reads the given columns of each table row (keyed by column index, plus the row index) and
 * counts the cells cut to the cell limit per column header, in column order.
 */
export function readImportedRows({
  columnIndices,
  headers,
  rows
}: {
  columnIndices: number[];
  headers: string[];
  rows: Element[];
}): ImportedRows {
  const cutCounts = new Map<number, number>();
  const readRows = rows.map((row, index) => {
    const cells = row.querySelectorAll('td');
    const cellTexts: Record<number, string> = {};
    for (const colIdx of columnIndices) {
      const cell = cells[colIdx];
      if (!cell) continue;
      const { text, wasCut } = readImportedCellText(cell);
      cellTexts[colIdx] = text;
      if (wasCut) cutCounts.set(colIdx, (cutCounts.get(colIdx) ?? 0) + 1);
    }
    return { ...cellTexts, index };
  });

  const cutCells = [...cutCounts.keys()]
    .toSorted((left, right) => left - right)
    .map((colIdx) => ({
      column: headers[colIdx] || `#${colIdx + 1}`,
      count: cutCounts.get(colIdx) ?? 0
    }));

  return { cutCells, rows: readRows };
}
