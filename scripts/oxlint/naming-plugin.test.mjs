import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RuleTester } from 'oxlint/plugins-dev';
import { describe, expect, it } from 'vitest';

import namingPlugin from './naming-plugin.mjs';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const WIRING_FIXTURE = `interface bad_interface { a: number }
enum Mode { lower_case }
export function f<t>(snake_case: number, okParam: number, _unused = 1) {
  return [snake_case, okParam, _unused];
}
export type Fine = bad_interface | Mode;
`;

// Runs the real oxlint binary with the project config, so a plugin that stops loading after an
// oxlint upgrade fails here instead of passing as a clean lint.
describe('naming plugin wiring', () => {
  it('reports through the project config', { timeout: 60_000 }, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'naming-plugin-'));
    try {
      const fixture = path.join(dir, 'fixture.ts');
      fs.writeFileSync(fixture, WIRING_FIXTURE);
      const result = runOxlint(fixture);
      const names = result.diagnostics
        .filter((diagnostic) => diagnostic.code === 'naming(naming-convention)')
        .map((diagnostic) => /"([^"]+)"/.exec(diagnostic.message)?.[1])
        .toSorted((a, b) => a.localeCompare(b, 'en'));
      expect(names).toEqual(['bad_interface', 'lower_case', 'snake_case', 't']);
    } finally {
      fs.rmSync(dir, { force: true, recursive: true });
    }
  });
});

function runOxlint(file) {
  const bin = path.join(appDir, 'node_modules/oxlint/bin/oxlint');
  const config = path.join(appDir, '.oxlintrc.json');
  try {
    execFileSync(
      process.execPath,
      [bin, '-c', config, '--disable-nested-config', '-f', 'json', file],
      {
        cwd: appDir,
        encoding: 'utf-8'
      }
    );
    return { diagnostics: [] };
  } catch (error) {
    // oxlint exits with 1 when it reports findings; the JSON report is on stdout.
    return JSON.parse(error.stdout);
  }
}

// RuleTester reserves one 6 GiB ArrayBuffer. Windows commits it against RAM and the page file, so
// on a small machine the allocation can fail: local Windows runs skip these cases unless
// FM_RULE_TESTS=1, and CI (Linux) always runs them.
const SKIP_RULE_TESTS =
  process.platform === 'win32' && process.env.CI === undefined && process.env.FM_RULE_TESTS !== '1';

RuleTester.describe = SKIP_RULE_TESTS ? describe.skip : describe;
RuleTester.it = it;

const ts = (code) => ({ code, filename: 'probe.ts' });
const invalid = (code, messageId) => ({ ...ts(code), errors: [{ messageId }] });

new RuleTester().run('naming-convention', namingPlugin.rules['naming-convention'], {
  valid: [
    ts('interface PlayerRow { a: number }'),
    ts('type RoleScore = number;'),
    ts('enum Mode { FULL_RUN, Lite }'),
    ts(
      'function pick<TValue>(value: TValue, _unused = 1, ...rest: number[]) { return [value, rest]; }'
    ),
    ts('const f = ({ snake_case }: { snake_case: number }) => snake_case;'),
    ts('function bound(this: Window, _: number, Component: unknown) { return [_, Component]; }'),
    ts('class ParseError extends Error {}')
  ],
  invalid: [
    invalid('interface player_row { a: number }', 'type'),
    invalid('type roleScore = number;', 'type'),
    invalid('enum mode { A }', 'type'),
    invalid('enum Mode { lower_case }', 'enumMember'),
    invalid('function pick<t>(value: t) { return value; }', 'type'),
    invalid('function f(snake_case: number) { return snake_case; }', 'parameter'),
    invalid('const f = (Bad_Name = 1) => Bad_Name;', 'parameter'),
    invalid('function f(...rest_args: number[]) { return rest_args; }', 'parameter')
  ]
});
