import { loadLeagueMappings } from '@/computing/ldcMappings';
import { canonicalizeNation } from '@/computing/ldcNations';
import { DEFAULT_LDC_SETTINGS, ldcSettings } from '@/config/ldcConfig';
import {
  loadSettings as loadLdcStoredSettings,
  saveSettings as saveLdcStoredSettings
} from '@/ldcStorage';

import { formatLdcValidationError, parseLdcSettingsPayload } from './ldcValidation';

import type { LDCModel, LdcSortColumn, LeagueData, LegacyLeagueMappings } from '@/config/ldcConfig';

export interface PersistedLdcSettingsPayload {
  alphaBasket: number;
  alphaSimple: number;
  baseLeague: string;
  baseLeagueNation?: string;
  enabled: boolean;
  leagues: LeagueData[];
  mappings: LegacyLeagueMappings;
  model: LDCModel;
  sortColumn?: LdcSortColumn;
  sortDirection?: 'asc' | 'desc';
}

const LEGACY_LDC_STORAGE_KEY = 'fm24-evaluator-ldc-v1'; // gitleaks:allow (localStorage key name, not a secret)

function canUseLdcStorageModule() {
  return typeof indexedDB !== 'undefined';
}

function formatPersistenceError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'unknown error';
  }
}

function auditPersistenceError(
  target: 'ldcStorage' | 'localStorage',
  type: 'load' | 'save',
  error: unknown
) {
  if ((window as any).addAudit) {
    (window as any).addAudit(
      `ldc_${type}_error`,
      { error: formatPersistenceError(error), target },
      'warn'
    );
  }
}

function validatePersistedPayload(payload: unknown): null | PersistedLdcSettingsPayload {
  const result = parseLdcSettingsPayload(payload);
  if (!result.success) {
    auditPersistenceError('localStorage', 'load', formatLdcValidationError(result.error));
    return null;
  }

  return {
    alphaBasket: result.data.alphaBasket ?? DEFAULT_LDC_SETTINGS.alphaBasket,
    alphaSimple: result.data.alphaSimple ?? DEFAULT_LDC_SETTINGS.alphaSimple,
    baseLeague: result.data.baseLeague ?? DEFAULT_LDC_SETTINGS.baseLeague,
    // Canonicalize on load so data persisted before this fix (or synced from
    // another device/session) does not carry raw FM codes forever.
    baseLeagueNation: canonicalizeNation(result.data.baseLeagueNation ?? ''),
    enabled: result.data.enabled ?? DEFAULT_LDC_SETTINGS.enabled,
    leagues: result.data.leagues.map((league) => ({
      ...league,
      nation: canonicalizeNation(league.nation),
      stars: league.stars ?? null
    })),
    mappings: result.data.mappings ?? {},
    model: result.data.model ?? DEFAULT_LDC_SETTINGS.model,
    sortColumn: result.data.sortColumn,
    sortDirection: result.data.sortDirection
  };
}

export async function loadPersistedLdcSettings(): Promise<null | PersistedLdcSettingsPayload> {
  if (canUseLdcStorageModule()) {
    try {
      const fromStore = await loadLdcStoredSettings();
      if (fromStore) {
        return validatePersistedPayload(fromStore);
      }
    } catch (error) {
      console.warn('LDC LOAD (ldcStorage) ERR', error);
      auditPersistenceError('ldcStorage', 'load', error);
    }
  }

  try {
    const raw = localStorage.getItem(LEGACY_LDC_STORAGE_KEY);
    return raw ? validatePersistedPayload(JSON.parse(raw)) : null;
  } catch (error) {
    console.warn('LDC LOAD ERR', error);
    auditPersistenceError('localStorage', 'load', error);
    return null;
  }
}

export function buildPersistedLdcSettingsPayload(): PersistedLdcSettingsPayload {
  return {
    alphaBasket: ldcSettings.alphaBasket,
    alphaSimple: ldcSettings.alphaSimple,
    baseLeague: ldcSettings.baseLeague,
    baseLeagueNation: ldcSettings.baseLeagueNation,
    enabled: ldcSettings.enabled,
    leagues: ldcSettings.leagues,
    mappings: loadLeagueMappings(),
    model: ldcSettings.model,
    sortColumn: ldcSettings.sortColumn,
    sortDirection: ldcSettings.sortDirection
  };
}

export async function savePersistedLdcSettings(
  payload: PersistedLdcSettingsPayload = buildPersistedLdcSettingsPayload()
): Promise<void> {
  if (canUseLdcStorageModule()) {
    try {
      await saveLdcStoredSettings(payload);
    } catch (error) {
      console.warn('LDC SAVE (ldcStorage) ERR', error);
      auditPersistenceError('ldcStorage', 'save', error);
    }
  }

  try {
    localStorage.setItem(LEGACY_LDC_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('LDC SAVE ERR', error);
    auditPersistenceError('localStorage', 'save', error);
  }
}
