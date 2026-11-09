import { describe, expect, it } from 'vitest';

import {
  loadMappingTemplates,
  saveMappingTemplates,
  templateNames,
  withoutTemplate,
  withTemplate
} from './ldcTemplatesModel';

const POLISH = { 'Liga A||Polska': { name: 'Ekstraklasa', nation: 'Polska' } };
const LEGACY = { 'Liga B': 'I liga' };

describe('mapping templates', () => {
  it('adds a template under its trimmed name without touching the given objects', () => {
    const templates = { Stary: LEGACY };
    const next = withTemplate(templates, '  Nowy ', POLISH);
    expect(next).toEqual({ Nowy: POLISH, Stary: LEGACY });
    expect(templates).toEqual({ Stary: LEGACY });
    const { Nowy: saved } = next;
    expect(saved).not.toBe(POLISH);
  });

  it('replaces a template of the same name', () => {
    expect(withTemplate({ Sezon: LEGACY }, 'Sezon', POLISH)).toEqual({ Sezon: POLISH });
  });

  it('removes only the named template', () => {
    expect(withoutTemplate({ A: LEGACY, B: POLISH }, 'A')).toEqual({ B: POLISH });
    expect(withoutTemplate({ A: LEGACY }, 'missing')).toEqual({ A: LEGACY });
  });

  it('lists names in Polish alphabetical order', () => {
    expect(templateNames({ Zima: {}, Łotwa: {}, Lato: {}, Mecz: {} })).toEqual([
      'Lato',
      'Łotwa',
      'Mecz',
      'Zima'
    ]);
  });
});

describe('loadMappingTemplates', () => {
  it('reads nothing saved as no templates', async () => {
    expect(await loadMappingTemplates(() => Promise.resolve(null))).toEqual({
      kind: 'templates',
      templates: {}
    });
  });

  it('reads both the current and the single-file version shape of a mapping target', async () => {
    const stored = { Nowy: POLISH, Stary: LEGACY };
    expect(await loadMappingTemplates(() => Promise.resolve(stored))).toEqual({
      kind: 'templates',
      templates: stored
    });
  });

  it('reports a value that does not parse, or a failed read, as an error', async () => {
    const invalid = await loadMappingTemplates(() => Promise.resolve({ Zly: { a: 42 } }));
    const failed = await loadMappingTemplates(() => Promise.reject(new Error('blocked')));
    expect([invalid.kind, failed.kind]).toEqual(['error', 'error']);
  });
});

describe('saveMappingTemplates', () => {
  it('reports a failed write as an error', async () => {
    const result = await saveMappingTemplates({}, () => Promise.reject(new Error('quota')));
    expect(result.kind).toBe('error');
  });

  it('passes the templates to the store', async () => {
    const saved: unknown[] = [];
    const result = await saveMappingTemplates({ A: POLISH }, (templates) => {
      saved.push(templates);
      return Promise.resolve();
    });
    expect([result.kind, saved]).toEqual(['saved', [{ A: POLISH }]]);
  });
});
