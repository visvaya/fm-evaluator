/*
 * Legacy-layer ratchet. Every metric here may only fall.
 *
 *   pnpm legacy:metrics            report, compared with the committed baseline
 *   pnpm legacy:metrics --json     machine-readable report
 *   pnpm legacy:metrics:check      exit 1 if any metric differs from the baseline
 *   pnpm legacy:metrics:update     write the current values as the new baseline
 *
 * A rise is a regression. A fall is progress, and the baseline must be updated
 * in the same change so the lower value becomes the new ceiling.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { collectGlobals, scanSources } from './lib/legacy-scan.mjs';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const srcDir = fileURLToPath(new URL('../src', import.meta.url));
const baselineUrl = new URL('legacy-metrics.baseline.json', import.meta.url);

const LABELS = {
  windowBridges: 'window.* bridges (names written in src/)',
  windowBridgeWrites: 'window.* bridge writes',
  windowGlobalReads: 'window.* reads of non-platform names',
  jsFilesInSrc: '.js files in src/',
  innerHtmlWrites: 'innerHTML writes in src/',
  largestFileLines: 'largest src/ file (lines)'
};

async function measure() {
  const scans = await scanSources(rootDir, srcDir);
  const globalsByName = collectGlobals(scans);
  const bridges = globalsByName.filter((entry) => entry.kind === 'bridge');
  // Ties go to the alphabetically first path, so the result does not depend on scan order.
  const largest = scans.reduce((worst, scan) =>
    scan.lines > worst.lines || (scan.lines === worst.lines && scan.file < worst.file)
      ? scan
      : worst
  );

  return {
    metrics: {
      windowBridges: bridges.length,
      windowBridgeWrites: bridges.reduce((sum, entry) => sum + entry.writes.length, 0),
      windowGlobalReads: globalsByName.reduce((sum, entry) => sum + entry.reads.length, 0),
      jsFilesInSrc: scans.filter((scan) => /\.[cm]?jsx?$/.test(scan.file)).length,
      innerHtmlWrites: scans.reduce((sum, scan) => sum + scan.innerHtmlWrites.length, 0),
      largestFileLines: largest.lines
    },
    largestFile: largest.file,
    globals: globalsByName
  };
}

async function readBaseline() {
  try {
    return JSON.parse(await readFile(baselineUrl, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function compare(current, baseline) {
  return Object.entries(current.metrics).map(([key, value]) => {
    const ceiling = baseline?.metrics?.[key];
    const status =
      ceiling === undefined ? 'new' : value > ceiling ? 'rose' : value < ceiling ? 'fell' : 'held';
    return { key, value, ceiling, status };
  });
}

function printReport(report, rows) {
  const width = Math.max(...Object.values(LABELS).map((label) => label.length));
  for (const { key, value, ceiling, status } of rows) {
    const note = status === 'held' ? '' : `  (baseline ${ceiling ?? '-'}, ${status})`;
    console.log(`${LABELS[key].padEnd(width)}  ${String(value).padStart(6)}${note}`);
  }
  console.log(`\nLargest file: ${report.largestFile}`);

  const nameWidth = Math.max(...report.globals.map((entry) => entry.name.length));
  console.log('\nGlobal names by use (writes/reads, kind):');
  const byUse = report.globals.toSorted(
    (left, right) =>
      right.writes.length + right.reads.length - (left.writes.length + left.reads.length) ||
      left.name.localeCompare(right.name)
  );
  for (const entry of byUse) {
    const counts = `${entry.writes.length}/${entry.reads.length}`;
    console.log(`  ${entry.name.padEnd(nameWidth)}  ${counts.padStart(5)}  ${entry.kind}`);
  }
}

const args = new Set(process.argv.slice(2));
const report = await measure();

if (args.has('--update')) {
  const baseline = { metrics: report.metrics, largestFile: report.largestFile };
  await writeFile(baselineUrl, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log('Baseline updated.');
} else if (args.has('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const rows = compare(report, await readBaseline());
  if (args.has('--check')) {
    const risen = rows.filter((row) => row.status === 'rose' || row.status === 'new');
    const fallen = rows.filter((row) => row.status === 'fell');
    for (const row of risen) {
      console.error(`ROSE  ${LABELS[row.key]}: ${row.ceiling ?? '-'} -> ${row.value}`);
    }
    for (const row of fallen) {
      console.error(`FELL  ${LABELS[row.key]}: ${row.ceiling} -> ${row.value}`);
    }
    if (risen.length > 0) {
      console.error('\nA legacy metric rose. Remove the new debt instead of raising the baseline.');
      process.exit(1);
    }
    if (fallen.length > 0) {
      console.error('\nProgress: run `pnpm legacy:metrics:update` and commit the lower baseline.');
      process.exit(1);
    }
    console.log(`Legacy metrics held (${rows.length} checked).`);
  } else {
    printReport(report, rows);
  }
}
