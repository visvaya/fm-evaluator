#!/usr/bin/env node
// Usage: node scripts/check-suppressions-growth.mjs <base suppressions> <base .oxlintrc.json>
// Fails when the oxlint suppressions baseline grew against the base branch, except for rules whose
// configuration changed in the same change (scripts/lib/suppressions-growth-core.mjs). CI passes
// the base branch's files; the current ones are read from the working tree.
import fs from 'node:fs';

import {
  findChangedRules,
  findSuppressionGrowth,
  parseJsonWithComments
} from './lib/suppressions-growth-core.mjs';

const [baseSuppressionsPath, baseConfigPath] = process.argv.slice(2);
if (!baseSuppressionsPath || !baseConfigPath) {
  console.error(
    'Usage: check-suppressions-growth.mjs <base suppressions file> <base .oxlintrc.json>'
  );
  process.exit(2);
}

const read = (file) => parseJsonWithComments(fs.readFileSync(file, 'utf-8'));
const changedRules = findChangedRules(read(baseConfigPath), read('.oxlintrc.json'));
const growth = findSuppressionGrowth(
  read(baseSuppressionsPath),
  read('oxlint-suppressions.json'),
  changedRules
);
if (growth.length > 0) {
  growth.forEach(({ file, rule, from, to }) =>
    console.error(`check:suppressions: ${file} ${rule}: ${from} -> ${to}`)
  );
  console.error(
    'check:suppressions: frozen findings may only shrink. Fix the new finding instead of freezing it; freezing is for a rule whose configuration changes in the same pull request.'
  );
  process.exit(1);
}
console.log(
  `check:suppressions: the baseline did not grow (rules with a changed configuration: ${changedRules.size}).`
);
