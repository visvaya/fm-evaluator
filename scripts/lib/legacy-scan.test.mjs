import { describe, expect, it } from 'vitest';

import { collectGlobals, countLines, parseSource, scanAst } from './legacy-scan.mjs';

const scan = (source, file = 'src/probe.ts') => scanAst(parseSource(source, file));
const summary = (source, file) =>
  scan(source, file).accesses.map(({ name, kind, line }) => `${kind}:${name}@${line}`);

describe('scanAst', () => {
  it('classifies plain and cast writes and reads', () => {
    const source = [
      'window.A = 1;',
      '(window as any).B = window.A;',
      'globalThis.C = (window as unknown as { A: number }).A;'
    ].join('\n');
    expect(summary(source)).toEqual([
      'write:A@1',
      'write:B@2',
      'read:A@2',
      'write:C@3',
      'read:A@3'
    ]);
  });

  it('follows aliases of window by name', () => {
    expect(summary('const w: any = window as any;\nw.store.x = 1;\nw.COLUMNS = [];')).toEqual([
      'read:store@2',
      'write:COLUMNS@3'
    ]);
  });

  it('counts Object.assign, defineProperty, destructuring, delete and update', () => {
    const source = [
      'Object.assign(window, { a, b: 2, "c": 3 });',
      "Object.defineProperty(window, 'd', { value: 1 });",
      'const { e } = window;',
      'delete (window as any).f;',
      'window.g++;'
    ].join('\n');
    expect(summary(source)).toEqual([
      'write:a@1',
      'write:b@1',
      'write:c@1',
      'write:d@2',
      'read:e@3',
      'write:f@4',
      'write:g@5'
    ]);
  });

  it('counts compound assignment as write and read', () => {
    expect(summary('window.k += 1;')).toEqual(['read:k@1', 'write:k@1']);
  });

  it('reads optional calls and typeof checks', () => {
    expect(summary('window.h?.();\nif (typeof window.i === "function") {}')).toEqual([
      'read:h@1',
      'read:i@2'
    ]);
  });

  it('counts innerHTML writes but not reads', () => {
    const source = 'el.innerHTML = "";\nel.innerHTML += x;\nconst y = el.innerHTML;';
    expect(scan(source).innerHtmlWrites).toEqual([1, 2]);
  });

  it('collects runtime imports and skips type-only ones', () => {
    const source = [
      "import './side-effect.js';",
      "import type { T } from './types';",
      "import { a } from '@/lib/a';",
      "export { b } from './b';",
      "const c = await import('./c');",
      "new Worker(new URL('./w.worker.ts', import.meta.url));"
    ].join('\n');
    expect(scan(source).imports.map(({ specifier }) => specifier)).toEqual([
      './side-effect.js',
      '@/lib/a',
      './b',
      './c',
      './w.worker.ts'
    ]);
  });

  it('parses TSX', () => {
    expect(summary('const V = () => <div>{window.J}</div>;', 'src/v.tsx')).toEqual(['read:J@1']);
  });
});

describe('collectGlobals', () => {
  it('separates bridges from read-only names and skips platform APIs', () => {
    const scans = [
      { file: 'a.ts', accesses: [{ name: 'Bridge', kind: 'write', line: 1 }] },
      {
        file: 'b.ts',
        accesses: [
          { name: 'Bridge', kind: 'read', line: 2 },
          { name: 'Vendor', kind: 'read', line: 3 },
          { name: 'location', kind: 'write', line: 4 },
          { name: 'addEventListener', kind: 'read', line: 5 }
        ]
      }
    ];
    expect(collectGlobals(scans)).toEqual([
      { name: 'Bridge', writes: ['a.ts:1'], reads: ['b.ts:2'], kind: 'bridge' },
      { name: 'Vendor', writes: [], reads: ['b.ts:3'], kind: 'external' }
    ]);
  });
});

describe('countLines', () => {
  it('ignores the trailing newline and handles CRLF', () => {
    expect(countLines('a\nb\n')).toBe(2);
    expect(countLines('a\r\nb')).toBe(2);
  });
});
