// Shared test support for the local oxlint plugins.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RuleTester } from 'oxlint/plugins-dev';
import { describe, it } from 'vitest';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// RuleTester reserves one 6 GiB ArrayBuffer. Windows commits it against RAM and the page file, so
// on a small machine the allocation can fail: local Windows runs skip these cases unless
// FM_RULE_TESTS=1, and CI (Linux) always runs them.
export function configureRuleTester() {
  const skip =
    process.platform === 'win32' &&
    process.env.CI === undefined &&
    process.env.FM_RULE_TESTS !== '1';
  RuleTester.describe = skip ? describe.skip : describe;
  RuleTester.it = it;
}

/**
 * Lints `source` as a TypeScript file with the real oxlint binary and the project config, so a
 * plugin that stops loading after an oxlint upgrade fails a test instead of passing as a clean
 * lint. Returns the diagnostics of the given rule code.
 */
export function lintWithProjectConfig(source, ruleCode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oxlint-plugin-'));
  try {
    const fixture = path.join(dir, 'fixture.ts');
    fs.writeFileSync(fixture, source);
    return runOxlint(fixture).diagnostics.filter((diagnostic) => diagnostic.code === ruleCode);
  } finally {
    fs.rmSync(dir, { force: true, recursive: true });
  }
}

function runOxlint(file) {
  const bin = path.join(appDir, 'node_modules/oxlint/bin/oxlint');
  const config = path.join(appDir, '.oxlintrc.json');
  try {
    execFileSync(
      process.execPath,
      [bin, '-c', config, '--disable-nested-config', '-f', 'json', file],
      { cwd: appDir, encoding: 'utf-8' }
    );
    return { diagnostics: [] };
  } catch (error) {
    // oxlint exits with 1 when it reports findings; the JSON report is on stdout.
    return JSON.parse(error.stdout);
  }
}
