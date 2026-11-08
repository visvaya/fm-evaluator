/**
 * Pins `integer` and `physical` parsing on both parser paths. No golden fixture
 * reaches these types, so the goldens would not notice a change. The worker
 * runs in the default node environment with comlink's `expose` captured.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { UniversalParser } from '../parsing/universalParser.js';

import type { SchemaInfo } from '../parsing/parserTypes';
import type { ParserApi } from './parser.worker';

let workerApi: ParserApi | undefined;

vi.mock('comlink', () => ({
  expose: (api: ParserApi) => {
    workerApi = api;
  }
}));

beforeAll(async () => {
  await import('./parser.worker');
});

const INTEGER: SchemaInfo = { id: 'basic_age', type: 'integer' };
const PHYSICAL: SchemaInfo = { id: 'physical_test', type: 'physical' };

const integerCases: [string, Record<string, unknown>, null | number][] = [
  ['25', {}, 25],
  ['1,234', { thousandSeparator: ',' }, 1234],
  ['1.234', { thousandSeparator: '.' }, 1234],
  ['1 234', {}, 1234],
  ['12.7', {}, 12],
  ['25 years', {}, 25],
  ['-', {}, null],
  ['', {}, null],
  ['abc', {}, null]
];

const physicalCases: [string, Record<string, unknown>, null | number][] = [
  ['185 cm', {}, 185],
  ['75,5 kg', { decimalSeparator: ',' }, 75.5],
  ['75.5 kg', {}, 75.5],
  // Aggressive cleaning keeps digits only: feet and inches collapse into one number.
  ['6\'1"', {}, 61],
  ['-', {}, null],
  ['N/A', {}, null]
];

function parseWithWorker(value: string, schema: SchemaInfo, ctx: Record<string, unknown>) {
  if (!workerApi) throw new Error('parser.worker.ts did not expose its API');
  return workerApi.parse(value, schema, ctx).value;
}

describe.each([
  [
    'fallback UniversalParser',
    (v: string, s: SchemaInfo, c: Record<string, unknown>) => new UniversalParser().parse(v, s, c)
  ],
  ['worker parserApi', parseWithWorker]
])('%s', (_name, parse) => {
  it.each(integerCases)('integer %j with %j -> %j', (value, ctx, expected) => {
    expect(parse(value, INTEGER, ctx)).toBe(expected);
  });

  it.each(physicalCases)('physical %j with %j -> %j', (value, ctx, expected) => {
    expect(parse(value, PHYSICAL, ctx)).toBe(expected);
  });
});

describe('worker parseBatch in the node environment', () => {
  // No jsdom here: anything in the worker's import graph that touches window or
  // document at import time would already have failed in beforeAll.
  function batch(values: string[], schemaInfo: SchemaInfo, extra: Record<string, unknown> = {}) {
    if (!workerApi) throw new Error('parser.worker.ts did not expose its API');
    return workerApi.parseBatch(
      structuredClone({ formatContext: {}, schemaInfo, values, ...extra })
    ).results;
  }

  const WAGE: SchemaInfo = { id: 'basic_wage', supportsFrequency: true, type: 'currency' };

  it('has no window or document in scope', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('rebuilds the plain normalisation config and normalises wages to yearly', () => {
    const plain = {
      targetDistanceUnit: 'km',
      targetWageFrequency: 'yearly',
      unknownUnitMultipliers: {}
    };
    expect(batch(['£1,700 p/a', '£100 p/w'], WAGE, { normalizationConfig: plain })).toEqual([
      { value: 1700 },
      { value: 5200 }
    ]);
  });

  it('treats a missing or null config as no normalisation', () => {
    expect(batch(['£100 p/w'], WAGE)).toEqual([{ value: 100 }]);
    if (!workerApi) throw new Error('parser.worker.ts did not expose its API');
    expect(workerApi.parse('£100 p/w', WAGE, {}, null).value).toBe(100);
  });

  it('translates enums through the language config', () => {
    const languageConfig = { valueTranslations: { position: { 'O (L)': 'D (L)' } } };
    expect(batch(['O (L)'], { id: 'basic_position', type: 'enum' }, { languageConfig })).toEqual([
      { value: 'D (L)' }
    ]);
  });

  it('returns ISO dates like the shared DateParser', () => {
    expect(batch(['30.6.2025'], { id: 'basic_expires', type: 'date' })).toEqual([
      { value: '2025-06-30' }
    ]);
  });
});
