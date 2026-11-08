/*
 * TypeScript strictness ratchet. tsconfig.json keeps `strict: false`; this script counts
 * the errors `tsc --strict` with the target flags below would report, and every count may only
 * fall.
 *
 *   pnpm strict:metrics            report, compared with the committed baseline
 *   pnpm strict:metrics:check      exit 1 if the total, any code or any file differs
 *   pnpm strict:metrics:update     write the current counts as the new baseline
 *
 * A rise is a regression. A fall is progress, and the baseline must be updated
 * in the same change so the lower value becomes the new ceiling.
 */
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { compareSummaries, parseTscOutput, summarize } from './lib/strict-metrics-core.mjs';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const baselineUrl = new URL('strict-metrics.baseline.json', import.meta.url);
// TypeScript 7 exports only its package.json and version, not bin/tsc, so resolve the binary
// next to package.json.
const tscPath = path.join(
  path.dirname(createRequire(import.meta.url).resolve('typescript/package.json')),
  'bin/tsc'
);

// The flags of the target tsconfig beyond strict; each is switched on in tsconfig.json once its
// errors reach zero.
const TARGET_FLAGS = [
  '--noUncheckedIndexedAccess',
  '--exactOptionalPropertyTypes',
  '--noImplicitOverride',
  '--noPropertyAccessFromIndexSignature',
  '--verbatimModuleSyntax',
  '--erasableSyntaxOnly'
];

function runStrictTsc() {
  const result = spawnSync(
    process.execPath,
    [tscPath, '--noEmit', '-p', 'tsconfig.json', '--strict', ...TARGET_FLAGS, '--pretty', 'false'],
    { cwd: rootDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  if (result.error) throw result.error;
  const output = `${result.stdout}${result.stderr}`;
  const diagnostics = parseTscOutput(output);
  // Exit 0 means no errors; exit 2 means errors were emitted. Anything else is a tsc failure.
  if (result.status !== 0 && diagnostics.length === 0) {
    throw new Error(`tsc exited with ${result.status} without diagnostics:\n${output}`);
  }
  return summarize(diagnostics);
}

async function readBaseline() {
  try {
    return JSON.parse(await readFile(baselineUrl, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

const describeRow = (row) => (row.group === 'total' ? 'total' : `${row.group} ${row.key}`);

function printReport(summary, comparison) {
  console.log(`Errors under --strict and the target flags: ${summary.total}`);
  console.log('\nBy code:');
  for (const [code, count] of Object.entries(summary.byCode)) {
    console.log(`  ${code.padEnd(8)}  ${String(count).padStart(4)}`);
  }
  console.log(`\nFiles with errors: ${Object.keys(summary.byFile).length}`);
  const changed = [...comparison.risen, ...comparison.fallen];
  if (changed.length === 0) {
    console.log('\nAll counts equal the baseline.');
    return;
  }
  console.log('\nDifferences from the baseline:');
  for (const row of changed) {
    console.log(
      `  ${row.status.toUpperCase()}  ${describeRow(row)}: ${row.ceiling} -> ${row.value}`
    );
  }
}

function check(comparison) {
  for (const row of comparison.risen) {
    console.error(`ROSE  ${describeRow(row)}: ${row.ceiling} -> ${row.value}`);
  }
  for (const row of comparison.fallen) {
    console.error(`FELL  ${describeRow(row)}: ${row.ceiling} -> ${row.value}`);
  }
  if (comparison.risen.length > 0) {
    console.error(
      '\nA strict-mode error count rose. Fix the new error instead of raising the baseline.'
    );
    return 1;
  }
  if (comparison.fallen.length > 0) {
    console.error('\nProgress: run `pnpm strict:metrics:update` and commit the lower baseline.');
    return 1;
  }
  console.log(`Strict metrics held (${comparison.rows.length} counts checked).`);
  return 0;
}

const args = new Set(process.argv.slice(2));
const summary = runStrictTsc();

if (args.has('--update')) {
  await writeFile(baselineUrl, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`Baseline updated (${summary.total} errors).`);
} else {
  const comparison = compareSummaries(summary, await readBaseline());
  if (args.has('--check')) {
    process.exitCode = check(comparison);
  } else {
    printReport(summary, comparison);
  }
}
