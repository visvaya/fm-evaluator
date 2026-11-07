#!/usr/bin/env node
// Fails on the em dash (U+2014), emoji, bidi control characters or external CDN hosts in tracked
// text files (or in the files passed as arguments, as lint-staged does). Exclusions live in scripts/lib/typography-core.mjs.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findTypographyIssues, isCheckedPath, isProbablyText } from './lib/typography-core.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function listTrackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: appDir, encoding: 'utf-8' })
    .split('\0')
    .filter(Boolean);
}

function toRepoRelative(file) {
  return path.relative(appDir, path.resolve(appDir, file)).replaceAll('\\', '/');
}

function issuesForFile(file) {
  const absolute = path.join(appDir, file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) return [];
  const buffer = fs.readFileSync(absolute);
  if (!isProbablyText(buffer)) return [];
  return findTypographyIssues(buffer.toString('utf-8')).map((issue) => ({ file, ...issue }));
}

function main(argv) {
  const files = (argv.length > 0 ? argv.map(toRepoRelative) : listTrackedFiles()).filter(
    isCheckedPath
  );
  const issues = files.flatMap(issuesForFile);
  issues.forEach(({ file, line, column, kind }) =>
    console.error(`check:typography: ${file}:${line}:${column} ${kind}`)
  );
  if (issues.length > 0) {
    console.error(
      `check:typography: ${issues.length} issue(s). em-dash: use an en dash (U+2013) or a middle dot (U+00B7); emoji: remove; bidi: remove the control character; cdn: self-host the file (the CSP allows only the own origin).`
    );
    return 1;
  }
  console.log(`check:typography: ${files.length} file(s) clean.`);
  return 0;
}

process.exitCode = main(process.argv.slice(2));
