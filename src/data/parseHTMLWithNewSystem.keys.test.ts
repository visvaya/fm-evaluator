// @vitest-environment jsdom
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import './goldenLegacyGlobals';
import { processor } from './dataProcessor';

const APP_DIR = path.join(fileURLToPath(import.meta.url), '..', '..', '..');
const PUBLIC_DIR = path.join(APP_DIR, 'public');
const FIXTURES = ['fm-export-en-uk.html', 'fm-export-en-us.html', 'fm-export-pl.html'];

interface ParsedEntry {
  columnMap?: Record<string, string>;
  parsedData?: Record<string, unknown>[];
}

interface Registry {
  get: (schemaId: string) => { type?: string } | undefined;
  getLegacyHeaderName: (schemaId: string) => null | string;
}

// Every English key must hold the value of its own schema field. A localized header that equals
// another column's English key (Polish "Str" is Long Shots, English "Str" is Strength; the Polish
// export has two "Drb" columns) must not overwrite it.
async function keyMismatches(fixture: string): Promise<string[]> {
  const html = await readFile(path.join(APP_DIR, 'goldens', 'fixtures', fixture), 'utf8');
  processor.fileStack = [];
  await processor.parseHTML(html, null, false, new File([html], fixture));
  const entry = (processor.fileStack as unknown[])[0] as undefined | ParsedEntry;
  const registry = (processor as unknown as { schemaRegistry: Registry }).schemaRegistry;
  const rows = entry?.parsedData ?? [];
  return Object.values(entry?.columnMap ?? {}).flatMap((schemaId) => {
    const key = registry.getLegacyHeaderName(schemaId);
    if (!key || registry.get(schemaId)?.type === 'date') return [];
    return rows
      .filter((row) => row[schemaId] !== null && row[schemaId] !== undefined)
      .filter((row) => row[key] !== row[schemaId])
      .map(
        (row) =>
          `${key} (${schemaId}): ${JSON.stringify(row[key])} != ${JSON.stringify(row[schemaId])}`
      )
      .slice(0, 1);
  });
}

describe('parsed row keys', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', async (input: string) => {
      const body = await readFile(path.join(PUBLIC_DIR, input), 'utf8');
      return new Response(body, { headers: { 'Content-Type': 'application/json' }, status: 200 });
    });
    processor._initNewSystem();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(FIXTURES)('keeps each English key equal to its schema field in %s', async (fixture) => {
    expect(await keyMismatches(fixture)).toEqual([]);
  });

  it('keeps the bounds of a money range next to its midpoint', async () => {
    const html = await readFile(
      path.join(APP_DIR, 'goldens', 'fixtures', 'fm-export-en-uk.html'),
      'utf8'
    );
    processor.fileStack = [];
    await processor.parseHTML(html, null, false, new File([html], 'bounds.html'));
    const entry = (processor.fileStack as unknown[])[0] as undefined | ParsedEntry;
    // The fixture's "9K € - 35K €" range, whose midpoint is 22000.
    const ranged = (entry?.parsedData ?? []).find(
      ({ basic_transfer_value: value }) => value === 22_000
    );
    expect(ranged).toMatchObject({
      basic_transfer_value: 22_000,
      basic_transfer_value_high: 35_000,
      basic_transfer_value_low: 9000
    });
  });
});
