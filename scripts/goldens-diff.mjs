#!/usr/bin/env node
/**
 * Structural diff of golden snapshots against a git ref (default HEAD).
 * Usage: pnpm run goldens:diff [<base-ref>]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import { diffSnapshots, formatDiff, parseSnapshot } from './lib/goldens-diff-core.mjs';

const SNAPSHOT_DIR = 'goldens/snapshots/';
const GIT_MAX_BUFFER_BYTES = 256 * 1024 * 1024;

const git = (args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER_BYTES });

const readAtRef = (ref, file) => {
  try {
    return git(['show', `${ref}:${file}`]);
  } catch {
    return undefined;
  }
};

const readWorking = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : undefined);

const main = () => {
  const ref = process.argv[2] ?? 'HEAD';
  const changed = [
    ...new Set([
      ...git(['diff', '--name-only', ref, '--', SNAPSHOT_DIR]).split('\n'),
      ...git(['ls-files', '--others', '--exclude-standard', '--', SNAPSHOT_DIR]).split('\n')
    ])
  ].filter(Boolean);
  if (changed.length === 0) {
    console.log(`No snapshot changes against ${ref}.`);
    return;
  }
  const reports = changed.map((file) =>
    formatDiff(
      file,
      diffSnapshots(parseSnapshot(readAtRef(ref, file)), parseSnapshot(readWorking(file)))
    )
  );
  console.log(reports.join('\n\n'));
};

main();
