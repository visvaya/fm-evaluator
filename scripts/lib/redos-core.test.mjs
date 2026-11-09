import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

import { collectPatterns, judgeResults } from './redos-core.mjs';

const collect = (text) => collectPatterns(parseSync('file.ts', text).program, text);

describe('collectPatterns', () => {
  it('finds literals and RegExp calls with plain string arguments, with their lines', () => {
    const text = [
      'const a = /x+y/gi;',
      "const b = new RegExp('a|b', 'u');",
      'const c = RegExp(`z*`);',
      'const d = { nested: [/q?/] };'
    ].join('\n');
    expect(collect(text)).toEqual([
      { source: 'x+y', flags: 'gi', line: 1 },
      { source: 'a|b', flags: 'u', line: 2 },
      { source: 'z*', flags: '', line: 3 },
      { source: 'q?', flags: '', line: 4 }
    ]);
  });

  it('marks a pattern or flags built at runtime as dynamic', () => {
    const text = ['new RegExp(name);', "new RegExp('a', flags);", 'new RegExp(`a${b}`);'].join(
      '\n'
    );
    expect(collect(text)).toEqual([
      { dynamic: true, line: 1 },
      { dynamic: true, line: 2 },
      { dynamic: true, line: 3 }
    ]);
  });

  it('ignores other constructors and strings that only look like patterns', () => {
    expect(collect("new Set('a+'); const s = '/a+/'; other.RegExp('b');")).toEqual([]);
  });
});

describe('judgeResults', () => {
  const flagged = { file: 'src/a.ts', line: 3, source: 'a+a+', flags: '', status: 'vulnerable' };
  const accepted = { file: 'src/a.ts', source: 'a+a+', flags: '', reason: 'bounded input' };

  it('fails a flagged pattern without an accepted entry and passes a safe one', () => {
    const safe = { ...flagged, source: 'a', status: 'safe' };
    expect(judgeResults({ results: [flagged, safe], accepted: [] })).toEqual({
      dynamic: [],
      unaccepted: [flagged],
      stale: []
    });
  });

  it('treats an unknown verdict like a vulnerable one', () => {
    const unknown = { ...flagged, status: 'unknown' };
    expect(judgeResults({ results: [unknown], accepted: [] }).unaccepted).toEqual([unknown]);
  });

  it('accepts a flagged pattern by file, source and flags, wherever its line moved', () => {
    const moved = { ...flagged, line: 40 };
    expect(judgeResults({ results: [moved], accepted: [accepted] })).toEqual({
      dynamic: [],
      unaccepted: [],
      stale: []
    });
  });

  it('does not accept the same source under other flags or in another file', () => {
    const otherFlags = { ...flagged, flags: 'g' };
    const otherFile = { ...flagged, file: 'src/b.ts' };
    expect(
      judgeResults({ results: [otherFlags, otherFile], accepted: [accepted] }).unaccepted
    ).toEqual([otherFlags, otherFile]);
  });

  it('reports an accepted entry whose pattern is now safe or gone as stale', () => {
    const nowSafe = { ...flagged, status: 'safe' };
    expect(judgeResults({ results: [nowSafe], accepted: [accepted] }).stale).toEqual([accepted]);
    expect(judgeResults({ results: [], accepted: [accepted] }).stale).toEqual([accepted]);
  });

  it('returns dynamic patterns separately', () => {
    const dynamic = { file: 'src/a.ts', line: 1, dynamic: true };
    expect(judgeResults({ results: [dynamic], accepted: [] })).toEqual({
      dynamic: [dynamic],
      unaccepted: [],
      stale: []
    });
  });
});
