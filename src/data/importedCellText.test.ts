// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { IMPORT_LIMITS } from '@/config/importLimits';

import {
  filesWithCutCells,
  formatCutCellColumns,
  readImportedCellText,
  readImportedRows
} from './importedCellText';

const LIMIT = IMPORT_LIMITS.cellTextLengthChars;

function cellWith(text: string): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.textContent = text;
  return cell;
}

function rowWith(...texts: string[]): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.append(...texts.map((text) => cellWith(text)));
  return row;
}

describe('readImportedCellText', () => {
  it('returns the trimmed text of a cell', () => {
    expect(readImportedCellText(cellWith('  Arsenal  '))).toEqual({
      text: 'Arsenal',
      wasCut: false
    });
  });

  it('keeps text of exactly the cell limit whole', () => {
    expect(readImportedCellText(cellWith('a'.repeat(LIMIT)))).toEqual({
      text: 'a'.repeat(LIMIT),
      wasCut: false
    });
  });

  it('cuts text longer than the cell limit and says so', () => {
    expect(readImportedCellText(cellWith('a'.repeat(LIMIT * 4)))).toEqual({
      text: 'a'.repeat(LIMIT),
      wasCut: true
    });
  });

  it('does not leave whitespace at the cut', () => {
    const head = 'a'.repeat(LIMIT - 1);

    expect(readImportedCellText(cellWith(`${head} tail`)).text).toBe(head);
  });

  it('returns an empty string for an empty cell', () => {
    expect(readImportedCellText(document.createElement('td'))).toEqual({
      text: '',
      wasCut: false
    });
  });
});

describe('filesWithCutCells', () => {
  it('keeps only the entries with cut cells', () => {
    const cutCells = [{ column: 'Notes', count: 2 }];

    expect(
      filesWithCutCells([
        { cutCells: [], name: 'clean.html' },
        { name: 'old.html' },
        null,
        { cutCells, name: 'long.html' },
        { cutCells }
      ])
    ).toEqual([
      { cutCells, name: 'long.html' },
      { cutCells, name: '' }
    ]);
  });
});

describe('formatCutCellColumns', () => {
  it('lists each column with its count of cut cells', () => {
    expect(
      formatCutCellColumns([
        { column: 'Notes', count: 2 },
        { column: 'Name', count: 1 }
      ])
    ).toBe('Notes (2), Name (1)');
  });
});

describe('readImportedRows', () => {
  it('reads the mapped columns of each row with its index', () => {
    const { rows } = readImportedRows({
      columnIndices: [0, 2],
      headers: ['UID', 'Club', 'Name'],
      rows: [rowWith('1', 'Arsenal', ' Saka '), rowWith('2', 'Legia')]
    });

    expect(rows).toEqual([
      { 0: '1', 2: 'Saka', index: 0 },
      { 0: '2', index: 1 }
    ]);
  });

  it('counts cut cells per column header', () => {
    const long = 'a'.repeat(LIMIT + 1);

    const { cutCells } = readImportedRows({
      columnIndices: [0, 1, 2],
      headers: ['UID', 'Notes', 'Name'],
      rows: [rowWith('1', long, long), rowWith('2', long, 'Saka'), rowWith('3', 'short', 'Kane')]
    });

    expect(cutCells).toEqual([
      { column: 'Notes', count: 2 },
      { column: 'Name', count: 1 }
    ]);
  });

  it('names a column without a header by its position', () => {
    const { cutCells } = readImportedRows({
      columnIndices: [1],
      headers: ['UID'],
      rows: [rowWith('1', 'a'.repeat(LIMIT + 1))]
    });

    expect(cutCells).toEqual([{ column: '#2', count: 1 }]);
  });

  it('reports no cut cells for ordinary rows', () => {
    const { cutCells } = readImportedRows({
      columnIndices: [0],
      headers: ['UID'],
      rows: [rowWith('1')]
    });

    expect(cutCells).toEqual([]);
  });
});
