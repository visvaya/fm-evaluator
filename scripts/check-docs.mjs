#!/usr/bin/env node
// Documentation hygiene check.
// Usage: pnpm run docs:check [-- --max-age-days=120]
// Fails on docs that no other doc references (by file or directory name) and on backticked file
// paths that do not exist. Warns (without failing) on "Last Reviewed" dates older than the limit,
// so CI does not turn red just because time passed.
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_MAX_AGE_DAYS = 120;
const MS_PER_DAY = 86_400_000;
const ROOT = process.cwd();
const DOC_ROOTS = ['docs', 'README.md', 'goldens/README.md'];
const TEXT_FILE = /\.(md|txt)$/;
const PATH_PREFIXES = ['docs/', 'src/', 'e2e/', 'scripts/', 'public/', 'goldens/', '.github/'];
// Lines that talk about removed files are not dead links.
const IGNORE_LINE =
  /(nie istnieje|no longer|is gone|removed|usunięt|former|dawn|outdated|assumed)/i;
const ENTRY_DOCS = new Set(['README.md', 'docs/README.md']);

const maxAgeArg = process.argv.find((arg) => arg.startsWith('--max-age-days='));
const maxAgeDays = maxAgeArg ? Number(maxAgeArg.split('=')[1]) : DEFAULT_MAX_AGE_DAYS;

const toPosix = (p) => p.split(path.sep).join('/');

const walk = (entry) => {
  const full = path.join(ROOT, entry);
  if (!fs.existsSync(full)) return [];
  if (fs.statSync(full).isFile()) return [toPosix(entry)];
  return fs.readdirSync(full).flatMap((name) => walk(path.join(entry, name)));
};

const files = DOC_ROOTS.flatMap(walk);
const texts = new Map(
  files
    .filter((f) => TEXT_FILE.test(f))
    .map((f) => [f, fs.readFileSync(path.join(ROOT, f), 'utf8')])
);

const isReferenced = (file) => {
  const names = [path.posix.basename(file), `${path.posix.basename(path.posix.dirname(file))}/`];
  return [...texts].some(([other, text]) => other !== file && names.some((n) => text.includes(n)));
};

const LINE_TERMINATORS = new Set([0x0a, 0x0d, 0x2028, 0x2029].map((c) => String.fromCodePoint(c)));

// Drops a line or anchor suffix: from the first ":" or "#" of the last line on, as
// /[:#].*$/ did, but in one pass instead of retrying from every ":" or "#".
const stripAnchor = (ref) => {
  let cut = -1;
  for (let i = ref.length - 1; i >= 0 && !LINE_TERMINATORS.has(ref[i]); i--) {
    if (ref[i] === ':' || ref[i] === '#') cut = i;
  }
  return cut === -1 ? ref : ref.slice(0, cut);
};

const exists = (fromFile, ref) => {
  const clean = stripAnchor(ref).replace(/\/$/, '');
  return [ROOT, path.dirname(path.join(ROOT, fromFile))].some((base) =>
    fs.existsSync(path.join(base, clean))
  );
};

const findDeadLinks = (file, text) =>
  text
    .split('\n')
    .filter((line) => !IGNORE_LINE.test(line))
    .flatMap((line) => [...line.matchAll(/`([^`\s]+)`/g)].map((m) => m[1]))
    .filter(
      (ref) =>
        PATH_PREFIXES.some((p) => ref.startsWith(p)) &&
        /\.[a-z]{2,5}(:\d+(-\d+)?)?$/.test(ref) &&
        !/[*{}<>]/.test(ref) &&
        !exists(file, ref)
    )
    .map((ref) => `${file}: ${ref}`);

const orphans = files.filter((f) => !ENTRY_DOCS.has(f) && !isReferenced(f));
const deadLinks = [...texts]
  .filter(([f]) => f.endsWith('.md'))
  .flatMap(([f, t]) => findDeadLinks(f, t));
const stale = [...texts].flatMap(([file, text]) => {
  const match = text.match(/^Last Reviewed: (\d{4}-\d{2}-\d{2})/m);
  if (!match) return [];
  const ageDays = Math.floor((Date.now() - Date.parse(match[1])) / MS_PER_DAY);
  return ageDays > maxAgeDays ? [`${file}: ${match[1]} (${ageDays} days)`] : [];
});

const report = (title, items) => {
  console.log(`${title}: ${items.length}`);
  for (const item of items) console.log(`  ${item}`);
};
report('Unreferenced docs', orphans);
report('Dead file references', deadLinks);
report(`Warning: Last Reviewed older than ${maxAgeDays} days`, stale);
process.exitCode = orphans.length + deadLinks.length > 0 ? 1 : 0;
