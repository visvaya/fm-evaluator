import { describe, expect, it } from 'vitest';

import {
  CDN_HOST_SOURCES,
  findTypographyIssues,
  isCheckedPath,
  isProbablyText
} from './typography-core.mjs';

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

const char = (codePoint) => String.fromCodePoint(codePoint);

describe('findTypographyIssues on bidi controls and CDN hosts', () => {
  const cdnHosts = CDN_HOST_SOURCES.map((source) => source.replaceAll(String.raw`\.`, '.'));

  it('reports bidi control characters (Trojan Source)', () => {
    expect(findTypographyIssues(`a${char(0x202e)}b`)).toEqual([
      { line: 1, column: 2, kind: 'bidi' }
    ]);
    const controls = [0x202a, 0x202d, 0x2066, 0x2069].map(char).join('');
    expect(findTypographyIssues(controls)).toEqual(
      [1, 2, 3, 4].map((column) => ({ line: 1, column, kind: 'bidi' }))
    );
  });

  it('does not flag the left-to-right and right-to-left marks', () => {
    expect(findTypographyIssues(`a${char(0x200e)}${char(0x200f)}b`)).toEqual([]);
  });

  it('reports external CDN hosts', () => {
    expect(cdnHosts).toHaveLength(5);
    cdnHosts.forEach((host) =>
      expect(findTypographyIssues(`<script src="https://${host}/x.js">`)).toEqual([
        { line: 1, column: 22, kind: 'cdn' }
      ])
    );
  });

  it('does not flag names that only contain a CDN host', () => {
    expect(findTypographyIssues('https://example.com/unpkg-com and myunpkg.community')).toEqual([]);
  });

  it('reports issues of every kind in column order', () => {
    expect(
      findTypographyIssues(`${cdnHosts[0]} ${char(0x202e)}`).map((issue) => issue.kind)
    ).toEqual(['cdn', 'bidi']);
  });
});
