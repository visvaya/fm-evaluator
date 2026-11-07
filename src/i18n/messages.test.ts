import { readdirSync, readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { compareCodeUnits } from '@/utils/compareCodeUnits';

// Guards public/i18n/messages/*.json: valid JSON, keys sorted at every level, Polish with exactly
// the English keys, and no other locale with keys that English lacks.
const MESSAGES_DIR = new URL('../../public/i18n/messages/', import.meta.url);
const INDEX_FILE = 'index.json';

type Messages = Record<string, unknown>;

const readMessages = (file: string): Messages =>
  JSON.parse(readFileSync(new URL(file, MESSAGES_DIR), 'utf8')) as Messages;

const isObject = (value: unknown): value is Messages =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const keyPaths = (messages: Messages, prefix = ''): string[] =>
  Object.entries(messages).flatMap(([key, value]) =>
    isObject(value) ? keyPaths(value, `${prefix}${key}.`) : [`${prefix}${key}`]
  );

const unsortedObjects = (messages: Messages, path = '(root)'): string[] => {
  const keys = Object.keys(messages);
  const own = keys.join('\n') === keys.toSorted(compareCodeUnits).join('\n') ? [] : [path];
  return [
    ...own,
    ...Object.entries(messages).flatMap(([key, value]) =>
      isObject(value) ? unsortedObjects(value, `${path}.${key}`) : []
    )
  ];
};

const files = readdirSync(MESSAGES_DIR).filter((file) => file.endsWith('.json'));
const englishKeys = keyPaths(readMessages('en.json'));

describe('i18n message files', () => {
  it.each(files)('%s has keys sorted at every level', (file) => {
    expect(unsortedObjects(readMessages(file))).toEqual([]);
  });

  it('pl.json has exactly the keys of en.json', () => {
    expect(keyPaths(readMessages('pl.json')).toSorted(compareCodeUnits)).toEqual(
      englishKeys.toSorted(compareCodeUnits)
    );
  });

  it.each(files.filter((file) => file !== INDEX_FILE))(
    '%s has only keys that en.json has',
    (file) => {
      const english = new Set(englishKeys);
      expect(keyPaths(readMessages(file)).filter((key) => !english.has(key))).toEqual([]);
    }
  );
});
