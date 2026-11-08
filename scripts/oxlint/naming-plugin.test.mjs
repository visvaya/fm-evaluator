import { RuleTester } from 'oxlint/plugins-dev';
import { describe, expect, it } from 'vitest';

import namingPlugin from './naming-plugin.mjs';
import { configureRuleTester, lintWithProjectConfig } from './plugin-test-support.mjs';

const WIRING_FIXTURE = `interface bad_interface { a: number }
enum Mode { lower_case }
export function f<t>(snake_case: number, okParam: number, _unused = 1) {
  return [snake_case, okParam, _unused];
}
export type Fine = bad_interface | Mode;
`;

describe('naming plugin wiring', () => {
  it('reports through the project config', { timeout: 60_000 }, () => {
    const names = lintWithProjectConfig(WIRING_FIXTURE, 'naming(naming-convention)')
      .map((diagnostic) => /"([^"]+)"/.exec(diagnostic.message)?.[1])
      .toSorted((a, b) => a.localeCompare(b, 'en'));
    expect(names).toEqual(['bad_interface', 'lower_case', 'snake_case', 't']);
  });
});

configureRuleTester();

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
