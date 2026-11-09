import { loadLdcMappingTemplatesDb, saveLdcMappingTemplatesDb } from '@/storage/db';

import { ldcMappingTemplatesSchema } from './ldcValidation';

import type { LegacyLeagueMappings } from '@/config/ldcConfig';

/** Template name to the league mappings saved under it. */
export type MappingTemplates = Readonly<Record<string, LegacyLeagueMappings>>;

export type LoadTemplatesResult =
  | { kind: 'error'; error: unknown }
  | { kind: 'templates'; templates: MappingTemplates };

export type SaveTemplatesResult = { kind: 'error'; error: unknown } | { kind: 'saved' };

const NAME_COLLATOR = new Intl.Collator('pl');

export function templateNames(templates: MappingTemplates): string[] {
  return Object.keys(templates).toSorted((left, right) => NAME_COLLATOR.compare(left, right));
}

export function withTemplate(
  templates: MappingTemplates,
  name: string,
  mappings: LegacyLeagueMappings
): MappingTemplates {
  return { ...templates, [name.trim()]: structuredClone(mappings) };
}

export function withoutTemplate(templates: MappingTemplates, name: string): MappingTemplates {
  return Object.fromEntries(Object.entries(templates).filter(([key]) => key !== name));
}

/**
 * Reads the saved templates. A stored value that does not parse is an error, not an empty list,
 * so the caller never overwrites templates it could not read.
 */
export async function loadMappingTemplates(
  load: () => Promise<unknown> = loadLdcMappingTemplatesDb
): Promise<LoadTemplatesResult> {
  try {
    const raw = await load();
    if (raw === null || raw === undefined) return { kind: 'templates', templates: {} };
    const parsed = ldcMappingTemplatesSchema.safeParse(raw);
    return parsed.success
      ? { kind: 'templates', templates: parsed.data }
      : { error: parsed.error, kind: 'error' };
  } catch (error) {
    return { error, kind: 'error' };
  }
}

export async function saveMappingTemplates(
  templates: MappingTemplates,
  save: (templates: MappingTemplates) => Promise<void> = saveLdcMappingTemplatesDb
): Promise<SaveTemplatesResult> {
  try {
    await save(templates);
    return { kind: 'saved' };
  } catch (error) {
    return { error, kind: 'error' };
  }
}
