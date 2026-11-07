import { describe, expect, it } from 'vitest';

import { findTypographyIssues, isCheckedPath, isProbablyText } from './typography-core.mjs';

const EM_DASH = '\u2014';

describe('isCheckedPath', () => {
  it('skips excluded directories', () => {
    expect(isCheckedPath('goldens/table.json')).toBe(false);
    expect(isCheckedPath('e2e/fixtures/a.html')).toBe(false);
    expect(isCheckedPath('public/vendor/x.js')).toBe(false);
  });

  it('checks everything else', () => {
    expect(isCheckedPath('src/ui/table.ts')).toBe(true);
    expect(isCheckedPath('docs/README.md')).toBe(true);
    expect(isCheckedPath('e2e/import.spec.ts')).toBe(true);
  });

  it('normalises Windows separators', () => {
    expect(isCheckedPath('public\\vendor\\x.js')).toBe(false);
  });
});

describe('isProbablyText', () => {
  it('treats content with a NUL byte as binary', () => {
    expect(isProbablyText(Buffer.from([0x50, 0x00, 0x41]))).toBe(false);
    expect(isProbablyText(Buffer.from('plain text'))).toBe(true);
  });
});

describe('findTypographyIssues', () => {
  it('returns nothing for clean text', () => {
    expect(findTypographyIssues('a \u2013 b\nc \u00b7 d')).toEqual([]);
  });

  it('reports em dashes with 1-based line and column', () => {
    expect(findTypographyIssues(`ok\nab${EM_DASH}c`)).toEqual([
      { line: 2, column: 3, kind: 'em-dash' }
    ]);
  });

  it('reports emoji presentation characters and U+FE0F', () => {
    expect(findTypographyIssues('x \u{1F680}')).toEqual([{ line: 1, column: 3, kind: 'emoji' }]);
    expect(findTypographyIssues('\u2764\uFE0F')).toEqual([{ line: 1, column: 2, kind: 'emoji' }]);
  });

  it('does not flag text-presentation symbols such as digits or the copyright sign', () => {
    expect(findTypographyIssues('123 # * \u00a9 \u2713')).toEqual([]);
  });
});
