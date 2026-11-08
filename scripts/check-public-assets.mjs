#!/usr/bin/env node
// Fails when a file under public/ is referenced by nothing (scripts/lib/public-assets-core.mjs).
// Walks the directories rather than git, so an untracked file that would also ship is caught too.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findUnreferencedPublicFiles } from './lib/public-assets-core.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REFERRER_PATTERN = /\.(?:css|html|js|json|mjs|ts|tsx|webmanifest)$/;
const TEST_FILE_PATTERN = /\.test\.[cm]?[jt]sx?$/;

function listFiles(relativeDir) {
  return fs
    .readdirSync(path.join(appDir, relativeDir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(appDir, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/')
    );
}

const publicFiles = listFiles('public').map((file) => file.slice('public/'.length));
const referrers = [
  'index.html',
  'vite.config.ts',
  'vite.shared.ts',
  ...listFiles('src'),
  ...listFiles('public')
]
  .filter((file) => REFERRER_PATTERN.test(file) && !TEST_FILE_PATTERN.test(file))
  .map((file) => ({ file, text: fs.readFileSync(path.join(appDir, file), 'utf-8') }));

const unreferenced = findUnreferencedPublicFiles(publicFiles, referrers);
if (unreferenced.length > 0) {
  unreferenced.forEach((file) =>
    console.error(`check:public-assets: public/${file} is not referenced`)
  );
  console.error(
    `check:public-assets: ${unreferenced.length} unreferenced file(s). Remove them, reference them, or add a runtime path pattern to scripts/lib/public-assets-core.mjs.`
  );
  process.exit(1);
}
console.log(`check:public-assets: ${publicFiles.length} file(s) under public/ are referenced.`);
