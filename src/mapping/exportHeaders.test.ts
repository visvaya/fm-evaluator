// @vitest-environment jsdom
// FM writes the columns of an export in the same order in every language, so the header row of
// each language must map column by column to the same schema fields as the English one.
// exportHeaders.fixture.json holds the header rows of one export view in the 18 languages.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import '../data/goldenLegacyGlobals';
import { validateLanguageConfig } from '../schema/contracts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LANGUAGES_DIR = path.join(HERE, '..', '..', 'public', 'config', 'languages');
const HEADER_ROWS = JSON.parse(
  readFileSync(path.join(HERE, 'exportHeaders.fixture.json'), 'utf8')
) as Record<string, string[]>;

interface HeaderMapper {
  detectLanguage: (headers: string[]) => string;
  mapHeaders: (
    headers: string[],
    config: unknown,
    registry: unknown
  ) => { columnMap: Record<string, string> };
}

type Constructor<T> = new () => T;

const globals = globalThis as unknown as {
  SchemaRegistry: Constructor<unknown>;
  SmartHeaderMapper: Constructor<HeaderMapper>;
};

// The config goes through the same validation as in the app (LanguageConfigLoader), which keeps
// only the fields the schema knows.
const loadConfig = (language: string) => {
  const result = validateLanguageConfig(
    JSON.parse(readFileSync(path.join(LANGUAGES_DIR, `${language}.json`), 'utf8'))
  );
  if (!result.success) throw new Error(`${language}: invalid language config`);
  return result.data;
};

const mapRow = (headers: string[], withContext = true) => {
  const mapper = new globals.SmartHeaderMapper();
  const { ambiguous, ...rest } = loadConfig(mapper.detectLanguage(headers));
  const config = withContext ? { ...rest, ambiguous } : rest;
  const { columnMap } = mapper.mapHeaders(headers, config, new globals.SchemaRegistry());
  return headers.map((_, index) => columnMap[String(index)] ?? null);
};

describe('header mapping across export languages', () => {
  let english: (null | string)[] = [];

  beforeAll(() => {
    english = mapRow(HEADER_ROWS['English-UK'] ?? []);
  });

  it('maps the English row to schema fields', () => {
    expect(english.filter(Boolean).length).toBeGreaterThan(120);
  });

  // Without a context for a repeated header the resolver falls back to its category; that
  // fallback already told the English "Nat" and the repeated Polish headers apart.
  it.each(['English-UK', 'Polski'])(
    'maps %s by category without the neighbour config',
    (language) => {
      const headers = HEADER_ROWS[language] ?? [];
      expect(mapRow(headers, false)).toEqual(english);
    }
  );

  it.each(Object.keys(HEADER_ROWS))('maps every %s column like the English one', (language) => {
    const headers = HEADER_ROWS[language] ?? [];
    const mismatches = mapRow(headers)
      .map((schemaId, index) => ({ english: english[index], header: headers[index], schemaId }))
      .filter((column) => column.schemaId !== column.english)
      .map((column) => `${column.header}: ${column.schemaId} instead of ${column.english}`);
    expect(mismatches).toEqual([]);
  });
});
