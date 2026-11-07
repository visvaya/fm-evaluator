#!/usr/bin/env node
// Guards the production build: dist/ may contain only Vite output (index.html, assets/)
// and files copied from public/, and the service worker must carry the generated precache
// manifest whose entries all exist in dist/. It also enforces the JS bundle budget
// (scripts/lib/bundle-budget.mjs) and prints the measured sizes on every run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BUNDLE_BUDGET, evaluateBundleBudget, formatKiB } from './lib/bundle-budget.mjs';
import { readPrecacheManifest } from './lib/sw-precache.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(appDir, 'dist');
const publicDir = path.join(appDir, 'public');
const VITE_OUTPUT = new Set(['index.html', 'assets']);

function listFiles(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? listFiles(path.join(dir, entry.name), relative) : [relative];
  });
}

function findUnexpectedFiles() {
  const publicFiles = new Set(listFiles(publicDir));
  return listFiles(distDir).filter(
    (file) => !VITE_OUTPUT.has(file.split('/')[0]) && !publicFiles.has(file)
  );
}

function findMissingPrecacheEntries() {
  const source = fs.readFileSync(path.join(distDir, 'service-worker.js'), 'utf-8');
  const { coreAssets, vendorAssets } = readPrecacheManifest(source);
  return [...coreAssets, ...vendorAssets].filter((url) => {
    const file = url === '/' ? 'index.html' : url.replace(/^\//, '');
    return !fs.existsSync(path.join(distDir, file));
  });
}

function listJsChunks() {
  const assetsDir = path.join(distDir, 'assets');
  if (!fs.existsSync(assetsDir)) return [];
  return fs
    .readdirSync(assetsDir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => ({ name, bytes: fs.statSync(path.join(assetsDir, name)).size }));
}

function describeViolation(violation) {
  const size = `${formatKiB(violation.bytes)} > ${formatKiB(violation.limitBytes)}`;
  return violation.kind === 'total'
    ? `check:dist: total dist/assets/*.js over budget: ${size}`
    : `check:dist: largest chunk ${violation.name} over budget: ${size}`;
}

function checkBundleBudget() {
  const { totalBytes, largest, violations } = evaluateBundleBudget({
    chunks: listJsChunks(),
    budget: BUNDLE_BUDGET
  });
  console.log(
    `check:dist: JS total ${formatKiB(totalBytes)} (limit ${formatKiB(BUNDLE_BUDGET.totalJsBytesMax)}); ` +
      `largest ${largest ? `${largest.name} ${formatKiB(largest.bytes)}` : 'none'} ` +
      `(limit ${formatKiB(BUNDLE_BUDGET.largestChunkBytesMax)}).`
  );
  violations.forEach((violation) => console.error(describeViolation(violation)));
  return violations;
}

function main() {
  if (!fs.existsSync(distDir)) {
    console.error('check:dist: dist/ does not exist; run `pnpm run build` first.');
    return 1;
  }
  const unexpected = findUnexpectedFiles();
  const missing = findMissingPrecacheEntries();
  unexpected.forEach((file) => console.error(`check:dist: not allowed in dist/: ${file}`));
  missing.forEach((url) => console.error(`check:dist: precache entry missing from dist/: ${url}`));
  const budgetViolations = checkBundleBudget();
  if (unexpected.length > 0 || missing.length > 0 || budgetViolations.length > 0) return 1;
  console.log(
    'check:dist: dist/ contains only allowed files; all precache entries present; bundle within budget.'
  );
  return 0;
}

process.exitCode = main();
