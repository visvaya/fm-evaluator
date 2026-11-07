export interface FileTypeResult {
  attributeCount: number;
  statisticCount: number;
  totalCount: number;
  type: 'attr' | 'both' | 'complete' | 'stats' | 'unknown';
}

export function detectFileType(
  columnMap: Record<string, any>,
  schemaRegistry: any
): FileTypeResult {
  if (!columnMap || Object.keys(columnMap).length === 0) {
    return { attributeCount: 0, statisticCount: 0, totalCount: 0, type: 'unknown' };
  }

  let attributeCount = 0;
  let statisticCount = 0;
  let basicOnlyCount = 0;
  let totalCount = 0;
  const mappedSchemaIds = new Set();

  for (const schemaId of Object.values(columnMap)) {
    if (!schemaId) continue;

    const schemaInfo = schemaRegistry.get(schemaId);
    if (!schemaInfo) continue;

    mappedSchemaIds.add(schemaId);
    totalCount++;

    if (schemaInfo.type === 'attribute') {
      attributeCount++;
    } else if (schemaInfo.type === 'statistic') {
      statisticCount++;
    }

    if (schemaInfo.category === 'basic') {
      basicOnlyCount++;
    }
  }

  if (basicOnlyCount === totalCount && totalCount > 0) {
    return { attributeCount, statisticCount, totalCount, type: 'unknown' };
  }

  const allSchemaIds = schemaRegistry.getAllIds();
  const allMapped = allSchemaIds.every((schemaId: string) => mappedSchemaIds.has(schemaId));
  if (allMapped && allSchemaIds.length > 0) {
    return { attributeCount, statisticCount, totalCount, type: 'complete' };
  }

  if (statisticCount === 0 && attributeCount > 0) {
    return { attributeCount, statisticCount, totalCount, type: 'attr' };
  }
  if (attributeCount === 0 && statisticCount > 0) {
    return { attributeCount, statisticCount, totalCount, type: 'stats' };
  }

  const attributePercent = totalCount > 0 ? (attributeCount / totalCount) * 100 : 0;
  const statisticPercent = totalCount > 0 ? (statisticCount / totalCount) * 100 : 0;

  if (attributePercent >= 70 && statisticPercent < 30) {
    return { attributeCount, statisticCount, totalCount, type: 'attr' };
  } else if (statisticPercent >= 70 && attributePercent < 30) {
    return { attributeCount, statisticCount, totalCount, type: 'stats' };
  } else if (attributePercent >= 30 && statisticPercent >= 30) {
    return { attributeCount, statisticCount, totalCount, type: 'both' };
  } else {
    return { attributeCount, statisticCount, totalCount, type: 'unknown' };
  }
}
