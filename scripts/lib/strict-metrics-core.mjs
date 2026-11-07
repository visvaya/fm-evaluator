/*
 * Pure logic of the TypeScript strictness ratchet (scripts/strict-metrics.mjs):
 * parse `tsc --pretty false` output, count errors and compare with a baseline.
 */

// tsc --pretty false prints one line per diagnostic: `path(line,col): error TS1234: message`.
// Continuation lines (indented) belong to the previous diagnostic and are ignored.
const DIAGNOSTIC_LINE = /^(\S[^(]*)\((\d+),(\d+)\): error (TS\d+): /;

export function parseTscOutput(output) {
  return output
    .split(/\r?\n/)
    .map((line) => DIAGNOSTIC_LINE.exec(line))
    .filter(Boolean)
    .map(([, file, line, column, code]) => ({
      file: file.replaceAll('\\', '/'),
      line: Number(line),
      column: Number(column),
      code
    }));
}

function countBy(diagnostics, key) {
  const counts = diagnostics.reduce(
    (acc, diagnostic) => acc.set(diagnostic[key], (acc.get(diagnostic[key]) ?? 0) + 1),
    new Map()
  );
  const sortedKeys = [...counts.keys()].toSorted();
  return Object.fromEntries(sortedKeys.map((name) => [name, counts.get(name)]));
}

export function summarize(diagnostics) {
  return {
    total: diagnostics.length,
    byCode: countBy(diagnostics, 'code'),
    byFile: countBy(diagnostics, 'file')
  };
}

function statusOf(value, ceiling) {
  if (value > ceiling) return 'rose';
  if (value < ceiling) return 'fell';
  return 'held';
}

function compareGroup(group, current, baseline) {
  const keys = [...new Set([...Object.keys(current), ...Object.keys(baseline)])].toSorted();
  return keys.map((key) => {
    const value = current[key] ?? 0;
    const ceiling = baseline[key] ?? 0;
    return { group, key, value, ceiling };
  });
}

// One row per metric (total, each code, each file); a missing baseline counts as zero.
export function compareSummaries(current, baseline) {
  const base = baseline ?? { total: 0, byCode: {}, byFile: {} };
  const rows = [
    { group: 'total', key: 'total', value: current.total, ceiling: base.total ?? 0 },
    ...compareGroup('code', current.byCode, base.byCode ?? {}),
    ...compareGroup('file', current.byFile, base.byFile ?? {})
  ].map((row) => ({ ...row, status: statusOf(row.value, row.ceiling) }));
  return {
    rows,
    risen: rows.filter((row) => row.status === 'rose'),
    fallen: rows.filter((row) => row.status === 'fell')
  };
}
