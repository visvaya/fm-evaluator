export interface MissingColumnsResult {
  missingOptional: string[];
  missingRequired: string[];
}

export function calculateMissingColumns(
  fileType: string,
  columnMap: Record<string, any>,
  schemaRegistry: any,
  headers: string[] = [],
  languageConfig: any = null
): MissingColumnsResult {
  const mappedSchemaIds = new Set(Object.values(columnMap).filter(Boolean));
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];

  const ignoredSchemaIds = new Set(['basic_information']);

  const derivableFields: Record<string, string[]> = {
    basic_age: ['basic_dob'],
    basic_preferred_foot: ['basic_left_foot', 'basic_right_foot']
  };

  const canBeDerived = (schemaId: string): boolean => {
    const sources = derivableFields[schemaId];
    if (!sources) return false;
    return sources.every((source) => mappedSchemaIds.has(source));
  };

  const isAmbiguousHeaderPresent = (schemaId: string): boolean => {
    if (!languageConfig?.ambiguous || !languageConfig.headers) return false;
    for (const [ambiguousHeader, config] of Object.entries(
      languageConfig.ambiguous as Record<string, any>
    )) {
      const ambiguousConfig = config;
      if (!ambiguousConfig?.context) continue;

      let canMapToSchemaId = false;
      const possibleSchemaIds: string[] = [];
      for (const [, contextConfig] of Object.entries(
        ambiguousConfig.context as Record<string, any>
      )) {
        possibleSchemaIds.push(contextConfig.target);
        if (contextConfig.target === schemaId) {
          canMapToSchemaId = true;
        }
      }

      if (!canMapToSchemaId) continue;

      const headerOccurrences = headers
        .map((_, idx) => idx)
        .filter((idx) => headers[idx] === ambiguousHeader);

      if (headerOccurrences.length === 0) continue;

      const isMapped = headerOccurrences.some((idx) => columnMap[idx] === schemaId);
      if (!isMapped) continue;

      const resolvedMappedIds = new Set<string>();
      let allOccurrencesMapped = true;

      for (const idx of headerOccurrences) {
        const mapped = columnMap[idx];
        if (mapped && possibleSchemaIds.includes(mapped)) {
          resolvedMappedIds.add(mapped);
        } else if (!mapped) {
          allOccurrencesMapped = false;
        }
      }

      if (allOccurrencesMapped && resolvedMappedIds.size === possibleSchemaIds.length) {
        return true;
      }
    }

    return false;
  };

  const getDisplayName = (schemaId: string): string => {
    const legacyName = schemaRegistry.getLegacyHeaderName(schemaId);
    return legacyName || schemaId;
  };

  const getOrderedSchemaIds = (): string[] => {
    if (!languageConfig?.headers) {
      return schemaRegistry.getAllIds();
    }
    const orderedIds = Object.keys(languageConfig.headers);
    const allIds: string[] = schemaRegistry.getAllIds();
    const orderedSet = new Set(orderedIds);
    const remaining = allIds.filter((id) => !orderedSet.has(id));
    return [...orderedIds, ...remaining];
  };

  const allSchemaIds = getOrderedSchemaIds();

  const INCLUDE_TYPES: Record<string, (info: any) => boolean> = {
    attr: (info) => info.category === 'basic' || info.type === 'attribute',
    both: (info) =>
      info.category === 'basic' || info.type === 'attribute' || info.type === 'statistic',
    complete: () => true,
    stats: (info) => info.category === 'basic' || info.type === 'statistic',
    unknown: (info) => info.category === 'basic'
  };

  const includeCheck = INCLUDE_TYPES[fileType] ?? INCLUDE_TYPES.unknown;

  for (const schemaId of allSchemaIds) {
    if (mappedSchemaIds.has(schemaId)) continue;
    if (canBeDerived(schemaId)) continue;
    if (ignoredSchemaIds.has(schemaId)) continue;
    if (isAmbiguousHeaderPresent(schemaId)) continue;

    const schemaInfo = schemaRegistry.get(schemaId);
    if (!schemaInfo) continue;

    if (!includeCheck(schemaInfo)) continue;

    const displayName = getDisplayName(schemaId);
    if (schemaInfo.required) {
      missingRequired.push(displayName);
    } else {
      missingOptional.push(displayName);
    }
  }

  return { missingOptional, missingRequired };
}
