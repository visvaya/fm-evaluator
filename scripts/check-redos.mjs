#!/usr/bin/env node
// Checks every regex in the shipped code with recheck, which searches each pattern for inputs
// that take super-linear time, and fails on a flagged pattern that scripts/redos-accepted.json
// does not list, on a stale entry there, and on a RegExp built at runtime.
// Scope: src/ and public/ (without vendor/), tests excluded: the oracle tests keep replaced
// patterns on purpose, and tests, scripts and e2e specs never see a user's input.
// recheck proves safety only for patterns without lookarounds or backreferences; for the rest
// it fuzzes, so "safe" there means only that no slow input was found.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseSync } from 'oxc-parser';
import { check } from 'recheck';

import { collectPatterns, judgeResults } from './lib/redos-core.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ACCEPTED_FILE = 'scripts/redos-accepted.json';
const CODE_PATTERN = /\.(?:[cm]?js|tsx?)$/;
const TEST_FILE_PATTERN = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
// Fixed seed so fuzzing gives the same verdict on every run; the timeout is per pattern.
const RECHECK_OPTIONS = { randomSeed: 1, timeout: 10_000 };

const listCode = (relativeDir) =>
  fs
    .readdirSync(path.join(appDir, relativeDir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(appDir, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/')
    )
    .filter((file) => CODE_PATTERN.test(file) && !TEST_FILE_PATTERN.test(file));

const files = [
  ...listCode('src'),
  ...listCode('public').filter((file) => !file.startsWith('public/vendor/'))
];

const patterns = files.flatMap((file) => {
  const text = fs.readFileSync(path.join(appDir, file), 'utf-8');
  const { program, errors } = parseSync(file, text);
  if (errors.length > 0) {
    console.error(`check:redos: ${file} does not parse: ${errors[0]?.message}`);
    process.exit(1);
  }
  return collectPatterns(program, text).map((pattern) => ({ file, ...pattern }));
});

const results = await Promise.all(
  patterns.map(async (pattern) => {
    if (pattern.dynamic) return pattern;
    const verdict = await check(pattern.source, pattern.flags, RECHECK_OPTIONS);
    return { ...pattern, status: verdict.status, complexity: verdict.complexity?.summary };
  })
);

const accepted = JSON.parse(fs.readFileSync(path.join(appDir, ACCEPTED_FILE), 'utf-8'));
const { dynamic, unaccepted, stale } = judgeResults({ results, accepted });

dynamic.forEach(({ file, line }) =>
  console.error(`check:redos: ${file}:${line} builds a RegExp at runtime; use a literal pattern`)
);
unaccepted.forEach(({ file, line, source, flags, status, complexity }) =>
  console.error(
    `check:redos: ${file}:${line} /${source}/${flags} is ${status} (${complexity ?? 'no result'})`
  )
);
stale.forEach(({ file, source, flags }) =>
  console.error(
    `check:redos: ${ACCEPTED_FILE} lists /${source}/${flags} in ${file}, which is no longer flagged; remove the entry`
  )
);
if (dynamic.length + unaccepted.length + stale.length > 0) {
  console.error(
    'check:redos: rewrite a flagged pattern so it runs in linear time (an oracle test proves it unchanged), ' +
      `or bound its input and add it to ${ACCEPTED_FILE} with the reason.`
  );
  process.exit(1);
}
console.log(
  `check:redos: ${results.length} pattern(s) in ${files.length} file(s), ${accepted.length} accepted with a reason.`
);
