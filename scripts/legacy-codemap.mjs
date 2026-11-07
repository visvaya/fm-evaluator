/*
 * Legacy codemap: which window.X bridges exist, who defines and reads them,
 * and in what order they can be replaced by ES imports (leaves first).
 *
 *   pnpm legacy:codemap                 report
 *   pnpm legacy:codemap --json          machine-readable graph
 *   pnpm legacy:codemap --bridge NAME   every write and read site of one bridge
 *   pnpm legacy:codemap --cycles        list files in every dependency cycle
 *
 * Syntactic match without scope analysis: a navigation aid, not a source of truth.
 * Verify every site in the code before acting on it.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { buildGraph, computeDepths, orderBridges } from './lib/legacy-graph.mjs';
import {
  collectGlobals,
  listAllFiles,
  listTestFiles,
  scanFiles,
  scanSources
} from './lib/legacy-scan.mjs';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const srcDir = fileURLToPath(new URL('../src', import.meta.url));
const e2eDir = fileURLToPath(new URL('../e2e', import.meta.url));
// Readers outside src/: inline handlers and scripts in the HTML entry points.
const HTML_ENTRIES = ['index.html'];

const escapeRegExp = (text) => text.replace(/[$()*+.?[\\\]^{|}]/g, '\\$&');

function renderColumns(rows) {
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)));
  return rows
    .map((row) =>
      row
        .map((cell, column) => cell.padEnd(widths[column]))
        .join('  ')
        .trimEnd()
    )
    .join('\n');
}

async function build() {
  const scans = await scanSources(rootDir, srcDir);
  const globalsByName = collectGlobals(scans);
  const edges = buildGraph(scans, globalsByName);
  const combined = computeDepths(edges);
  const windowOnly = computeDepths(edges, (edge) => edge.kind === 'window');
  const bridges = orderBridges(globalsByName, combined.depth).map((bridge) => ({
    ...bridge,
    windowDepth: Math.max(...bridge.definers.map((file) => windowOnly.depth.get(file) ?? 0))
  }));
  const html = await Promise.all(
    HTML_ENTRIES.map(async (file) => ({
      file,
      text: await readFile(new URL(`../${file}`, import.meta.url), 'utf8')
    }))
  );
  // Unit and E2E tests read bridges too (page.evaluate(() => window.X)); removing
  // a write breaks them even when no production file reads the name.
  const testScans = await scanFiles(rootDir, [
    ...(await listTestFiles(srcDir)),
    ...(await listAllFiles(e2eDir))
  ]);
  const testReaders = (name) =>
    testScans
      .filter((scan) => scan.accesses.some((access) => access.name === name))
      .map((scan) => scan.file);
  const htmlReaders = (name) =>
    html
      .filter(({ text }) => new RegExp(`\\b${escapeRegExp(name)}\\b`).test(text))
      .map(({ file }) => file);

  return {
    scans,
    globalsByName,
    edges,
    combined,
    windowOnly,
    bridges: bridges.map((bridge) => ({
      ...bridge,
      htmlReaders: htmlReaders(bridge.name),
      testReaders: testReaders(bridge.name)
    }))
  };
}

function printReport({ scans, globalsByName, edges, combined, windowOnly, bridges }) {
  const allEdges = [...edges.values()].flat();
  const importEdges = allEdges.filter((edge) => edge.kind === 'import').length;
  const read = bridges.filter((bridge) => bridge.readers.length > 0);
  const writeOnly = bridges.filter((bridge) => bridge.readers.length === 0);
  const external = globalsByName.filter((entry) => entry.kind === 'external');

  console.log(
    `Legacy codemap: ${scans.length} files in src/, ${bridges.length} bridges, ` +
      `${importEdges} import edges, ${allEdges.length - importEdges} window edges`
  );
  console.log(
    'DEPTH = longest chain of runtime dependencies (imports + window.X reads) inside src/, 0 = leaf.'
  );
  console.log('WDEPTH = the same over window.X edges only. Extract in ascending order.\n');

  console.log(`Bridges read in src/ (${read.length}), extraction order:`);
  console.log(
    renderColumns([
      ['DEPTH', 'WDEPTH', 'BRIDGE', 'TESTS', 'DEFINED IN', 'READ IN'],
      ...read.map((bridge) => [
        String(bridge.depth),
        String(bridge.windowDepth),
        bridge.name,
        String(bridge.testReaders.length),
        bridge.definers.join(', '),
        `${bridge.readers.join(', ')}${bridge.htmlReaders.length > 0 ? ` + ${bridge.htmlReaders.join(', ')}` : ''}`
      ])
    ])
  );

  console.log(`\nBridges with no reader in src/ (${writeOnly.length}):`);
  console.log('These are console APIs, HTML inline handlers or dead exports. Ask before removing.');
  console.log(
    renderColumns([
      ['BRIDGE', 'TESTS', 'DEFINED IN', 'NAME APPEARS IN'],
      ...writeOnly.map((bridge) => [
        bridge.name,
        String(bridge.testReaders.length),
        bridge.definers.join(', '),
        bridge.htmlReaders.join(', ') || '-'
      ])
    ])
  );

  console.log(`\nExternal names (read, never written in src/) (${external.length}):`);
  console.log(external.map((entry) => `${entry.name} (${entry.reads.length})`).join(', '));

  const touching = scans
    .map((scan) => ({
      ...scan,
      defines: scan.accesses.filter(
        (access) => access.kind === 'write' && bridges.some((b) => b.name === access.name)
      ).length,
      reads: scan.accesses.filter(
        (access) => access.kind === 'read' && globalsByName.some((g) => g.name === access.name)
      ).length
    }))
    .filter((scan) => scan.defines + scan.reads > 0)
    .sort(
      (left, right) =>
        (combined.depth.get(left.file) ?? 0) - (combined.depth.get(right.file) ?? 0) ||
        left.file.localeCompare(right.file)
    );
  console.log(`\nFiles touching window globals (${touching.length}):`);
  console.log(
    renderColumns([
      ['FILE', 'LINES', 'WRITES', 'READS', 'DEPTH', 'WDEPTH'],
      ...touching.map((scan) => [
        scan.file,
        String(scan.lines),
        String(scan.defines),
        String(scan.reads),
        String(combined.depth.get(scan.file) ?? 0),
        String(windowOnly.depth.get(scan.file) ?? 0)
      ])
    ])
  );

  const sizes = combined.cycles.map((cycle) => cycle.length).sort((a, b) => b - a);
  console.log(
    `\nDependency cycles: ${combined.cycles.length} (sizes ${sizes.join(', ') || '-'}); ` +
      `window-only cycles: ${windowOnly.cycles.length}. Details: --cycles`
  );
}

function printBridge({ globalsByName, bridges }, name) {
  const entry = globalsByName.find((candidate) => candidate.name === name);
  if (!entry) {
    console.error(`No window global named ${name}.`);
    process.exit(1);
  }
  const bridge = bridges.find((candidate) => candidate.name === name);
  console.log(`window.${name} (${entry.kind})`);
  if (bridge) console.log(`depth ${bridge.depth}, window depth ${bridge.windowDepth}`);
  console.log(`writes (${entry.writes.length}):\n  ${entry.writes.join('\n  ') || '-'}`);
  console.log(`reads (${entry.reads.length}):\n  ${entry.reads.join('\n  ') || '-'}`);
  if (bridge?.htmlReaders.length) console.log(`name appears in: ${bridge.htmlReaders.join(', ')}`);
  if (bridge?.testReaders.length) console.log(`tests: ${bridge.testReaders.join(', ')}`);
}

function printCycles({ combined, windowOnly }) {
  for (const [label, { cycles }] of [
    ['window-only', windowOnly],
    ['combined', combined]
  ]) {
    console.log(`${label} cycles: ${cycles.length}`);
    cycles.forEach((cycle, index) =>
      console.log(`  #${index + 1} (${cycle.length}): ${cycle.join(', ')}`)
    );
  }
}

const args = process.argv.slice(2);
const map = await build();

if (args.includes('--json')) {
  console.log(
    JSON.stringify(
      {
        bridges: map.bridges,
        external: map.globalsByName.filter((entry) => entry.kind === 'external'),
        files: map.scans.map((scan) => ({
          file: scan.file,
          lines: scan.lines,
          depth: map.combined.depth.get(scan.file),
          windowDepth: map.windowOnly.depth.get(scan.file),
          edges: map.edges.get(scan.file)
        })),
        cycles: { combined: map.combined.cycles, windowOnly: map.windowOnly.cycles }
      },
      null,
      2
    )
  );
} else if (args.includes('--bridge')) {
  printBridge(map, args[args.indexOf('--bridge') + 1]);
} else if (args.includes('--cycles')) {
  printCycles(map);
} else {
  printReport(map);
}
