// Copied from the project-baseline freshness reference; runs under Vitest with the other script tests.

import { expect, test } from 'vitest';

import {
  checkItems,
  engineFloor,
  formatReport,
  newestEligible,
  nodeFloorResult,
  parseList,
  parseVersion,
  readPin
} from './check-freshness.mjs';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const daysAgo = (days) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

test('a stable version is read from a version or a tag; pre-releases are not versions', () => {
  expect(parseVersion('v8.30.1')).toEqual([8, 30, 1]);
  expect(parseVersion('rust-v1.2.3')).toEqual([1, 2, 3]);
  expect(parseVersion('12.21.0')).toEqual([12, 21, 0]);
  expect(parseVersion('2.0.0-rc.1')).toBe(undefined);
  expect(parseVersion('nightly')).toBe(undefined);
  expect(parseVersion(undefined)).toBe(undefined);
});

test('the newest eligible release skips releases younger than the release age', () => {
  const releases = [
    { version: 'v1.9.0', publishedAt: daysAgo(30) },
    { version: 'v1.10.0', publishedAt: daysAgo(8) },
    { version: 'v1.11.0', publishedAt: daysAgo(2) },
    { version: 'v2.0.0-beta.1', publishedAt: daysAgo(20) }
  ];
  expect(newestEligible(releases, { nowMs: NOW, minAgeDays: 7 })).toEqual([1, 10, 0]);
  expect(newestEligible(releases, { nowMs: NOW, minAgeDays: 0 })).toEqual([1, 11, 0]);
  expect(newestEligible(releases, { nowMs: NOW, minAgeDays: 60 })).toBe(undefined);
});

test('a pin is read through the first capture group, and a lost pattern reads as undefined', () => {
  const workflow = 'env:\n  GITLEAKS_VERSION: "8.30.1"\n  GITLEAKS_SHA256: abc\n';
  expect(readPin(workflow, 'GITLEAKS_VERSION:[ "]*([0-9.]+)')).toEqual([8, 30, 1]);
  expect(readPin(workflow, 'ACTIONLINT_VERSION:[ "]*([0-9.]+)')).toBe(undefined);
  expect(
    readPin('{ "packageManager": "pnpm@12.14.0" }', '"packageManager": "pnpm@([0-9.]+)"')
  ).toEqual([12, 14, 0]);
});

test('the engines floor is the first full version of the range', () => {
  expect(engineFloor('^26.12.1')).toEqual([26, 12, 1]);
  expect(engineFloor('>=26.13.1 <27')).toEqual([26, 13, 1]);
  expect(engineFloor('>=26')).toBe(undefined);
});

const NODE_INDEX = [
  { version: 'v27.0.0', security: false },
  { version: 'v26.13.1', security: true },
  { version: 'v26.13.0', security: false },
  { version: 'v26.12.1', security: true },
  { version: 'v24.22.1', security: true }
];

test('a floor below the newest security release of the .nvmrc line is outdated', () => {
  const result = nodeFloorResult({ nvmrc: '26\n', engines: '^26.12.1', index: NODE_INDEX });
  expect(result.status).toBe('outdated');
  expect(result.text).toMatch(/raise the engines.node floor to 26\.13\.1 /);
});

test('a floor at the newest security release, or a line without one, is current', () => {
  expect(nodeFloorResult({ nvmrc: '26', engines: '^26.13.1', index: NODE_INDEX }).status).toBe(
    'ok'
  );
  expect(nodeFloorResult({ nvmrc: 'v28', engines: '^28.0.0', index: NODE_INDEX }).status).toBe(
    'ok'
  );
});

test('a floor that cannot be read is reported, not passed', () => {
  expect(nodeFloorResult({ nvmrc: 'lts/*', engines: '^26.13.1', index: NODE_INDEX }).status).toBe(
    'unreadable'
  );
  expect(nodeFloorResult({ nvmrc: '26', engines: '>=26', index: NODE_INDEX }).status).toBe(
    'unreadable'
  );
});

const LIST = {
  minimumReleaseAgeDays: 7,
  items: [
    { name: 'npm dependencies', mechanism: 'dependabot', where: 'npm, /' },
    {
      name: 'Node patch',
      mechanism: 'check-latest',
      where: '.nvmrc line, setup-node check-latest'
    },
    { name: 'Node floor', mechanism: 'job', check: { nodeFloor: true } },
    {
      name: 'pnpm',
      mechanism: 'job',
      check: { file: 'package.json', pattern: '"packageManager": "pnpm@([0-9.]+)"', npm: 'pnpm' },
      howToBump: 'set packageManager to the new version and run pnpm install'
    },
    {
      name: 'gitleaks',
      mechanism: 'job',
      check: {
        file: '.github/workflows/security.yml',
        pattern: 'GITLEAKS_VERSION:[ "]*([0-9.]+)',
        github: 'gitleaks/gitleaks'
      },
      howToBump: 'update GITLEAKS_VERSION and GITLEAKS_SHA256'
    },
    {
      name: 'zizmor',
      mechanism: 'job',
      check: {
        file: '.github/zizmor-requirements.txt',
        pattern: 'zizmor==([0-9.]+)',
        pypi: 'zizmor'
      },
      howToBump: 'update the version and the hashes in the requirements line'
    }
  ]
};

test('a valid list parses; every item needs a mechanism and every non-job item says where', () => {
  expect(parseList(LIST).ok).toBe(true);
  const broken = parseList({
    items: [
      { name: 'a', mechanism: 'renovate' },
      { name: 'b', mechanism: 'dependabot' },
      { name: 'c', mechanism: 'job', check: { file: 'x', pattern: '(1)' } },
      { name: 'd', mechanism: 'job', check: { file: 'x', pattern: '(1)', npm: 'd' } }
    ]
  });
  expect(broken.ok).toBe(false);
  expect(broken.error).toEqual([
    'a: mechanism must be one of dependabot, check-latest, job, manual',
    'a: where must say which configuration keeps it current',
    'b: where must say which configuration keeps it current',
    'c: a job check needs nodeFloor: true, or file, pattern and one of github, npm or pypi',
    'c: howToBump is missing',
    'd: howToBump is missing'
  ]);
  expect(parseList({ items: [] }).ok).toBe(false);
});

const FILES = {
  'package.json': JSON.stringify(
    { engines: { node: '^26.13.1' }, packageManager: 'pnpm@12.14.0' },
    null,
    2
  ),
  '.nvmrc': '26\n',
  '.github/workflows/security.yml': 'env:\n  GITLEAKS_VERSION: 8.30.1\n',
  '.github/zizmor-requirements.txt': 'zizmor==1.30.0 --hash=sha256:abc\n'
};
const RESPONSES = {
  'https://nodejs.org/dist/index.json': NODE_INDEX,
  'https://registry.npmjs.org/pnpm': {
    versions: { '12.14.0': {}, '12.21.0': {}, '13.0.0': {} },
    time: { '12.14.0': daysAgo(40), '12.21.0': daysAgo(10), '13.0.0': daysAgo(1) }
  },
  'https://api.github.com/repos/gitleaks/gitleaks/releases?per_page=100': [
    { tag_name: 'v8.30.1', published_at: daysAgo(50), draft: false, prerelease: false },
    { tag_name: 'v8.31.0', published_at: daysAgo(3), draft: false, prerelease: false }
  ],
  'https://pypi.org/pypi/zizmor/json': {
    releases: {
      '1.30.0': [{ upload_time_iso_8601: daysAgo(60) }],
      '1.31.0': [{ upload_time_iso_8601: daysAgo(20) }],
      '1.32.0': [{ upload_time_iso_8601: daysAgo(15), yanked: true }],
      '1.33.0': []
    }
  }
};

test('only job items are checked, with the release age applied to pins', async () => {
  const results = await checkItems({
    list: parseList(LIST).value,
    readText: (file) => FILES[file],
    fetchJson: async (url) => RESPONSES[url],
    nowMs: NOW
  });
  expect(results.map(({ name, status }) => [name, status])).toEqual([
    ['Node floor', 'ok'],
    ['pnpm', 'outdated'],
    ['gitleaks', 'ok'],
    ['zizmor', 'outdated']
  ]);
  expect(results[3].text).toMatch(/pinned 1\.30\.0, latest 1\.31\.0/);
  expect(results[1].text).toMatch(/pinned 12\.14\.0, latest 12\.21\.0: set packageManager/);
});

test('the report fails on any item that is not current and names it', () => {
  const report = formatReport([
    { name: 'gitleaks', status: 'ok', text: 'pinned 8.30.1, latest 8.30.1' },
    { name: 'pnpm', status: 'outdated', text: 'pinned 12.14.0, latest 12.21.0: bump' }
  ]);
  expect(report.exitCode).toBe(1);
  expect(report.text).toBe(
    'gitleaks: pinned 8.30.1, latest 8.30.1\npnpm: OUTDATED, pinned 12.14.0, latest 12.21.0: bump\n'
  );
  expect(formatReport([{ name: 'x', status: 'ok', text: 'fine' }]).exitCode).toBe(0);
});

test('a network failure propagates so the caller exits with 2', async () => {
  await expect(
    checkItems({
      list: parseList(LIST).value,
      readText: (file) => FILES[file],
      fetchJson: async () => {
        throw new Error('503 from api');
      },
      nowMs: NOW
    })
  ).rejects.toThrow(/503/);
});

test('pre-releases without a hyphen (PyPI rc, alpha, beta) are not stable', () => {
  expect(parseVersion('1.33.0rc1')).toBe(undefined);
  expect(parseVersion('2.0.0b2')).toBe(undefined);
  expect(parseVersion('1.32.0')?.join('.')).toBe('1.32.0');
});

test('the floor of a range is its lowest lower bound, whatever the order', () => {
  expect(engineFloor('<27.0.0 >=26.12.1')?.join('.')).toBe('26.12.1');
  expect(engineFloor('>= 26.12.1 < 27')?.join('.')).toBe('26.12.1');
  expect(engineFloor('>=26.13.1 >=26.12.1')?.join('.')).toBe('26.13.1');
  expect(engineFloor('26.12.1 - 26.14.0')?.join('.')).toBe('26.12.1');
  expect(engineFloor('^24.12.0 || ^26.12.1')?.join('.')).toBe('24.12.0');
  expect(engineFloor('26')).toBe(undefined);
});
