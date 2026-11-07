#!/usr/bin/env node
// Compares the fallback and worker golden snapshots of the import pipeline.
// Run from app/: pnpm run goldens:compare [case ...]
// Without arguments it compares every case. For each case it reports, per
// field, how many parsed rows, merged records and Default-engine scoring rows
// differ, with one example (fallback -> worker). Scoring rows are paired by
// position: they carry no UID (the harness keeps only fields scoring changed).
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(process.cwd(), 'goldens', 'snapshots');
const CASES = [
  'fm-export-en-uk',
  'fm-export-en-us',
  'fm-export-pl',
  'sample-en-attributes-and-stats',
  'sample-pl-attributes-and-stats'
];
const DETAIL_FIELDS = new Set(['attrDetails', 'filters', 'statDetails']);

const read = (name) => JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'));
const show = (value) => (JSON.stringify(value) ?? 'undefined').slice(0, 70);

function diffRows(fallbackRows, workerRows, label) {
  const fields = new Map();
  fallbackRows.forEach((row, index) => {
    const other = workerRows[index] ?? {};
    for (const key of new Set([...Object.keys(row), ...Object.keys(other)])) {
      if (DETAIL_FIELDS.has(key)) continue;
      if (JSON.stringify(row[key]) === JSON.stringify(other[key])) continue;
      const entry = fields.get(key) ?? {
        count: 0,
        example: `${show(row[key])} -> ${show(other[key])}`
      };
      entry.count += 1;
      fields.set(key, entry);
    }
  });
  const lines = [...fields.entries()].sort((a, b) => b[1].count - a[1].count);
  console.log(`  ${label}: ${lines.length === 0 ? 'identical' : `${lines.length} fields differ`}`);
  for (const [key, { count, example }] of lines) console.log(`    ${count} ${key}: ${example}`);
}

function compareCase(id) {
  console.log(`== ${id}`);
  const fallbackImport = read(`${id}.import.json`);
  const workerImport = read(`${id}.worker.import.json`);
  fallbackImport.forEach((file, index) => {
    const other = workerImport[index];
    for (const key of ['columnMap', 'detectedLanguage', 'formatContext', 'result']) {
      if (JSON.stringify(file[key]) !== JSON.stringify(other[key]))
        console.log(`  import ${file.file}: ${key} differs`);
    }
    diffRows(file.parsedData, other.parsedData, `parsed rows (${file.file})`);
  });
  diffRows(read(`${id}.merged.json`), read(`${id}.worker.merged.json`), 'merged records');

  const fallbackAnalysis = read(`${id}.analysis.json`).filter((row) => row.engine === 'Default');
  const workerAnalysis = read(`${id}.worker.analysis.json`);
  const tables = (rows) => rows.filter((row) => row.table);
  const reordered = tables(fallbackAnalysis)
    .filter(
      (row, index) =>
        JSON.stringify(row.table) !== JSON.stringify(tables(workerAnalysis)[index]?.table)
    )
    .map((row) => row.role);
  console.log(`  role tables reordered: ${reordered.length === 0 ? 'none' : reordered.join(', ')}`);
  const scores = (rows) => rows.filter((row) => !row.table);
  diffRows(scores(fallbackAnalysis), scores(workerAnalysis), 'Default scoring rows');
}

const requested = process.argv.slice(2);
for (const id of requested.length > 0 ? requested : CASES) compareCase(id);
