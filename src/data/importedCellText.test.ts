// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { IMPORT_LIMITS } from '@/config/importLimits';

import { readImportedCellText } from './importedCellText';

function cellWith(text: string): HTMLTableCellElement {
  const cell = document.createElement('td');
  cell.textContent = text;
  return cell;
}

describe('readImportedCellText', () => {
  it('returns the trimmed text of a cell', () => {
    expect(readImportedCellText(cellWith('  Arsenal  '))).toBe('Arsenal');
  });

  it('cuts text longer than the cell limit', () => {
    const text = readImportedCellText(cellWith('a'.repeat(IMPORT_LIMITS.cellTextLengthChars * 4)));

    expect(text).toBe('a'.repeat(IMPORT_LIMITS.cellTextLengthChars));
  });

  it('does not leave whitespace at the cut', () => {
    const head = 'a'.repeat(IMPORT_LIMITS.cellTextLengthChars - 1);

    expect(readImportedCellText(cellWith(`${head} tail`))).toBe(head);
  });

  it('returns an empty string for an empty cell', () => {
    expect(readImportedCellText(document.createElement('td'))).toBe('');
  });
});
