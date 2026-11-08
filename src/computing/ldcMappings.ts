/* eslint-disable fp/no-delete, fp/no-mutation */

import { errorText } from '@/utils/errorText';

import {
  type LdcLeagueReference,
  type LdcMappingTarget,
  type LeagueData,
  type LeagueMappings,
  type LegacyLeagueMappings,
  ldcMappingState,
  ldcSettings
} from '../config/ldcConfig';
import {
  loadMappings as loadLdcStoredMappings,
  saveMappings as saveLdcStoredMappings
} from '../ldcStorage';

import { normalizeLeagueNameForGrouping } from './ldcNameNormalization';
import { canonicalizeNation } from './ldcNations';

const LEAGUE_IDENTITY_SEPARATOR = '\u001F';

// Nations are canonicalized (FM codes and English names resolve to the
// Polish exonyms used by the league list) so identity keys and nation
// comparisons stay symmetric between player data and imported league lists.
function normalizeNation(nation: string) {
  return canonicalizeNation(nation).trim().toLocaleLowerCase();
}

export function createLeagueIdentityKey(source: LdcLeagueReference | string, nation = ''): string {
  const reference = typeof source === 'string' ? { name: source, nation } : source;
  const name = reference.name.trim();
  const sourceNation = canonicalizeNation(reference.nation).trim();
  return sourceNation.length > 0 ? `${name}${LEAGUE_IDENTITY_SEPARATOR}${sourceNation}` : name;
}

export function parseLeagueIdentityKey(key: string): LdcLeagueReference {
  const separatorIndex = key.lastIndexOf(LEAGUE_IDENTITY_SEPARATOR);
  if (separatorIndex === -1) {
    return { name: key, nation: '' };
  }

  return {
    name: key.slice(0, separatorIndex),
    nation: key.slice(separatorIndex + LEAGUE_IDENTITY_SEPARATOR.length)
  };
}

function canUseLdcStorageModule() {
  return typeof indexedDB !== 'undefined';
}

export function findLeagueByName(
  leagueName: string,
  leagues: readonly LeagueData[] = ldcSettings.leagues
): LeagueData | null {
  const exactMatches = leagues.filter((league) => league.name === leagueName);
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  const normalizedName = normalizeLeagueNameForGrouping(leagueName);
  const normalizedMatches = leagues.filter(
    (league) => normalizeLeagueNameForGrouping(league.name) === normalizedName
  );

  return normalizedMatches.length === 1 ? normalizedMatches[0] : null;
}

export function findLeagueByNameAndNation(
  leagueName: string,
  nation: string,
  leagues: readonly LeagueData[] = ldcSettings.leagues
): LeagueData | null {
  const normalizedName = normalizeLeagueNameForGrouping(leagueName);
  const normalizedNation = normalizeNation(nation);
  const exactMatches = leagues.filter(
    (league) =>
      normalizeLeagueNameForGrouping(league.name) === normalizedName &&
      normalizeNation(league.nation) === normalizedNation
  );

  return exactMatches.length === 1 ? exactMatches[0] : null;
}

function normalizeMappingTarget(
  target: LdcMappingTarget | string,
  leagues: readonly LeagueData[] = ldcSettings.leagues
): LdcMappingTarget {
  if (typeof target === 'string') {
    const matchedLeague = findLeagueByName(target, leagues);

    return {
      name: target,
      nation: matchedLeague?.nation ?? ''
    };
  }

  const targetNation = target.nation?.trim() ?? '';
  const matchedLeague =
    targetNation.length > 0
      ? findLeagueByNameAndNation(target.name, targetNation, leagues)
      : findLeagueByName(target.name, leagues);

  return {
    name: target.name,
    nation: targetNation || matchedLeague?.nation || ''
  };
}

export function normalizeLeagueMappings(
  mappings: LegacyLeagueMappings,
  leagues: readonly LeagueData[] = ldcSettings.leagues
): LeagueMappings {
  const normalizedMappings: LeagueMappings = {};

  for (const [source, target] of Object.entries(mappings)) {
    if (!source || !target) {
      continue;
    }

    normalizedMappings[source] = normalizeMappingTarget(target, leagues);
  }

  return normalizedMappings;
}

export function addLeagueMapping(
  source: LdcLeagueReference | string,
  target: LdcMappingTarget | string,
  nation?: string
): void {
  const mappings = loadLeagueMappings();
  mappings[createLeagueIdentityKey(source)] =
    typeof target === 'string'
      ? normalizeMappingTarget({ name: target, nation: nation ?? '' })
      : normalizeMappingTarget(target);
  saveLeagueMappings(mappings);
}

export async function ensureLdcMappingsLoadedAsync(): Promise<void> {
  if (ldcMappingState.initPromise !== null) return ldcMappingState.initPromise;
  if (!canUseLdcStorageModule()) return;
  ldcMappingState.initPromise = (async () => {
    try {
      const mappings = await loadLdcStoredMappings();
      if (mappings) {
        const normalizedMappings = normalizeLeagueMappings(mappings);
        ldcMappingState.cache = normalizedMappings;
        try {
          localStorage.setItem(
            'fm24-evaluator-ldc-mappings-v1',
            JSON.stringify(normalizedMappings)
          );
        } catch (error) {
          console.warn('LDC mappings cache to localStorage failed', error);
        }
      }
    } catch (error: any) {
      console.warn('LDC mappings load (ldcStorage) error:', error);
      if ((window as any).addAudit) {
        (window as any).addAudit('ldc_mappings_load_error', { error: String(error) }, 'warn');
      }
    }
  })();
  return ldcMappingState.initPromise;
}

export function getMappingTarget(
  mappings: LeagueMappings,
  sourceLeagueName: string,
  sourceNation = ''
): LdcMappingTarget | null {
  const normalizedSourceName = normalizeLeagueNameForGrouping(sourceLeagueName);
  const hasSourceNation = sourceNation.trim().length > 0;
  const directKeys = hasSourceNation
    ? [
        createLeagueIdentityKey(sourceLeagueName, sourceNation),
        createLeagueIdentityKey(normalizedSourceName, sourceNation)
      ]
    : [sourceLeagueName, normalizedSourceName];

  for (const key of directKeys) {
    if (mappings[key]) {
      return mappings[key];
    }
  }

  const normalizedSourceNation = normalizeNation(sourceNation);
  const matches = Object.entries(mappings).filter(([key]) => {
    const source = parseLeagueIdentityKey(key);
    if (normalizeLeagueNameForGrouping(source.name) !== normalizedSourceName) {
      return false;
    }

    return normalizedSourceNation.length === 0
      ? normalizeNation(source.nation).length === 0
      : normalizeNation(source.nation) === normalizedSourceNation;
  });

  return matches.length === 1 ? matches[0][1] : null;
}

export function getMappingTargetName(target: LdcMappingTarget | null | undefined): string {
  return target?.name ?? '';
}

export function getMappingTargetNation(target: LdcMappingTarget | null | undefined): string {
  return target?.nation ?? '';
}

export function resolveMappingTargetLeague(
  target: LdcMappingTarget | null | undefined,
  leagues: readonly LeagueData[] = ldcSettings.leagues
): LeagueData | null {
  if (!target) {
    return null;
  }

  if (target.nation.trim().length > 0) {
    return findLeagueByNameAndNation(target.name, target.nation, leagues);
  }

  return findLeagueByName(target.name, leagues);
}

export function loadLeagueMappings(): LeagueMappings {
  if (ldcMappingState.cache) return ldcMappingState.cache;
  try {
    const raw = localStorage.getItem('fm24-evaluator-ldc-mappings-v1');
    ldcMappingState.cache = raw ? normalizeLeagueMappings(JSON.parse(raw)) : {};
  } catch (error) {
    console.warn('LDC mappings load error:', error);
    if ((window as any).addAudit) {
      (window as any).addAudit('ldc_mappings_load_error', { error: String(error) }, 'warn');
    }
    ldcMappingState.cache = {};
  }
  return ldcMappingState.cache || {};
}

export function removeLeagueMapping(source: LdcLeagueReference | string): void {
  const mappings = loadLeagueMappings();
  delete mappings[createLeagueIdentityKey(source)];
  saveLeagueMappings(mappings);
}

const mappingsTransaction: { active: boolean; backup: LeagueMappings | null } = {
  active: false,
  backup: null
};

export function beginMappingsTransaction(): void {
  if (mappingsTransaction.active) return;
  mappingsTransaction.active = true;
  mappingsTransaction.backup = structuredClone(loadLeagueMappings());
}

export function commitMappingsTransaction(): void {
  if (!mappingsTransaction.active) return;
  mappingsTransaction.active = false;
  mappingsTransaction.backup = null;
  persistLeagueMappings(loadLeagueMappings());
}

export function rollbackMappingsTransaction(): void {
  if (!mappingsTransaction.active) return;
  mappingsTransaction.active = false;
  ldcMappingState.cache = mappingsTransaction.backup;
  mappingsTransaction.backup = null;
}

function persistLeagueMappings(normalizedMappings: LeagueMappings): void {
  if (canUseLdcStorageModule()) {
    saveLdcStoredMappings(normalizedMappings).catch((error: unknown) => {
      console.warn('LDC mappings save (ldcStorage) error:', error);
      if ((window as any).addAudit) {
        (window as any).addAudit('ldc_mappings_save_error', { error: errorText(error) }, 'warn');
      }
    });
  }
  try {
    localStorage.setItem('fm24-evaluator-ldc-mappings-v1', JSON.stringify(normalizedMappings));
  } catch (error) {
    console.warn('LDC mappings save error:', error);
    if ((window as any).addAudit) {
      (window as any).addAudit('ldc_mappings_save_error', { error: String(error) }, 'warn');
    }
  }
}

export function saveLeagueMappings(mappings: LegacyLeagueMappings): void {
  const normalizedMappings = normalizeLeagueMappings(mappings);
  ldcMappingState.cache = normalizedMappings;
  // During an edit-session transaction only the in-memory cache is updated;
  // storage is written once on commit (draft-session contract).
  if (mappingsTransaction.active) return;
  persistLeagueMappings(normalizedMappings);
}
