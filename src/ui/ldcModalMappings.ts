import { loadLeagueMappings, normalizeLeagueMappings } from '../computing/ldcMappings';

import type { LegacyLeagueMappings, LeagueMappings } from '../config/ldcConfig';

export function mergeMappingsImpl(
  newMappings: LegacyLeagueMappings,
  overwrite = false
): { added: number; errors: number; mappings: LeagueMappings; updated: number } {
  const existingMappings = loadLeagueMappings();
  const normalizedMappings = normalizeLeagueMappings(newMappings);
  const result: {
    added: number;
    errors: number;
    mappings: LeagueMappings;
    updated: number;
  } = {
    added: 0,
    errors: 0,
    mappings: { ...existingMappings },
    updated: 0
  };

  Object.entries(normalizedMappings).forEach(([source, target]) => {
    const existing = existingMappings[source];
    const hasConflict =
      existing && (existing.name !== target.name || existing.nation !== target.nation);

    if (hasConflict) {
      if (overwrite) {
        result.mappings[source] = target;
        result.updated += 1;
      }
      return;
    }

    if (!existingMappings[source]) {
      result.mappings[source] = target;
      result.added += 1;
    }
  });

  return result;
}

export function validateMappingsJSONImpl(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (!data.mappings || typeof data.mappings !== 'object') return false;

  for (const [key, value] of Object.entries(data.mappings)) {
    if (typeof key !== 'string') {
      return false;
    }

    if (typeof value === 'string') {
      continue;
    }

    if (
      typeof value !== 'object' ||
      value === null ||
      typeof (value as { name?: unknown }).name !== 'string' ||
      typeof (value as { nation?: unknown }).nation !== 'string'
    ) {
      return false;
    }
  }

  return true;
}
