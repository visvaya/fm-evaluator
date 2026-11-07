/* eslint-disable fp/no-mutation -- Mapping records are assembled into a compatibility record keyed by league identity. */

import { createLeagueIdentityKey, parseLeagueIdentityKey } from '@/computing/ldcMappings';

import type { LeagueMappings } from '@/config/ldcConfig';

export interface MappingRecord {
  source: string;
  sourceName: string;
  sourceNation: string;
  targetName: string;
  targetNation: string;
}

export type MappingColumn = 'source' | 'targetName' | 'targetNation';

export interface MappingColumnFilters {
  source: string;
  targetName: string;
  targetNation: string[];
}

export const EMPTY_MAPPING_FILTERS: MappingColumnFilters = {
  source: '',
  targetName: '',
  targetNation: []
};

export function cloneMappingRecords(records: MappingRecord[]) {
  return records.map((record) => ({ ...record }));
}

export function buildRecordsFromMappings(mappings: LeagueMappings): MappingRecord[] {
  return Object.entries(mappings)
    .map(([source, target]) => {
      const sourceReference = parseLeagueIdentityKey(source);
      return {
        source,
        sourceName: sourceReference.name,
        sourceNation: sourceReference.nation,
        targetName: target.name,
        targetNation: target.nation
      };
    })
    .toSorted((left, right) =>
      `${left.sourceName} ${left.sourceNation}`.localeCompare(
        `${right.sourceName} ${right.sourceNation}`
      )
    );
}

export function buildMappingsFromRecords(records: MappingRecord[]) {
  const mappings: LeagueMappings = {};

  for (const record of records) {
    mappings[createLeagueIdentityKey(record.sourceName, record.sourceNation)] = {
      name: record.targetName,
      nation: record.targetNation
    };
  }

  return mappings;
}

export function buildMappingRecordsSignature(records: MappingRecord[]) {
  return JSON.stringify(
    cloneMappingRecords(records).toSorted((left, right) => left.source.localeCompare(right.source))
  );
}

export function pushMappingHistory(
  historyStack: MappingRecord[][],
  historyIndex: number,
  nextSnapshot: MappingRecord[]
) {
  const normalizedSnapshot = cloneMappingRecords(nextSnapshot);
  const truncatedStack =
    historyIndex < historyStack.length - 1 ? historyStack.slice(0, historyIndex + 1) : historyStack;
  const nextStack = [...truncatedStack, normalizedSnapshot];

  return {
    historyIndex: nextStack.length - 1,
    historyStack: nextStack
  };
}

export function isMappingFilterActive(filters: MappingColumnFilters, column: MappingColumn) {
  return column === 'targetNation'
    ? filters.targetNation.length > 0
    : filters[column].trim().length > 0;
}

export function compareMappingRecords(
  left: MappingRecord,
  right: MappingRecord,
  column: MappingColumn
) {
  switch (column) {
    case 'source': {
      return `${left.sourceName} ${left.sourceNation}`.localeCompare(
        `${right.sourceName} ${right.sourceNation}`
      );
    }
    case 'targetName': {
      return left.targetName.localeCompare(right.targetName);
    }
    case 'targetNation': {
      return left.targetNation.localeCompare(right.targetNation);
    }
    default: {
      return left.source.localeCompare(right.source);
    }
  }
}
