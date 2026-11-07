/* eslint-disable @typescript-eslint/no-floating-promises, sonarjs/cognitive-complexity -- Legacy import/export flow mutates the shared LDC settings singleton by design. */

import { formatLdcValidationError, parseLdcSettingsPayload } from '@/features/ldc/ldcValidation';

import {
  loadDefaultLDCData,
  loadLeagueMappings,
  normalizeLeagueMappings,
  parseLDCCSV,
  parseLDCHTML,
  saveLeagueMappings
} from '../computing/ldc';
import { createLeagueIdentityKey } from '../computing/ldcMappings';
import { canonicalizeNation } from '../computing/ldcNations';
import { ldcSettings } from '../config/ldcConfig';

import { showAlertModal, showConfirmModal } from './ldcModalHelpers';
import { mergeMappingsImpl, validateMappingsJSONImpl } from './ldcModalMappings';
import { saveLDCSettings, updateLDCUI } from './ldcSettings';

import type { LegacyLeagueMappings } from '../config/ldcConfig';

interface BindImportExportListenersOptions {
  calculateLDC: () => void;
  onMappingsChanged: () => void;
  onSettingsChanged: () => void;
}

function clickInputById(id: string): void {
  document.querySelector<HTMLElement>(id)?.click();
}

// League identity is name+nation; comparing by name alone would treat a
// same-named league from another country as already present.
function leagueKey(league: { name: string; nation?: string }): string {
  return createLeagueIdentityKey(league.name, league.nation ?? '');
}

export function openLdcImportFilePicker(): void {
  clickInputById('#ldc-import-file');
}

export function openLdcImportMappingsFilePicker(): void {
  clickInputById('#ldc-import-mappings-file');
}

export function exportLdcSettingsAction(): void {
  const data = {
    alphaBasket: ldcSettings.alphaBasket,
    alphaSimple: ldcSettings.alphaSimple,
    baseLeague: ldcSettings.baseLeague,
    baseLeagueNation: ldcSettings.baseLeagueNation,
    enabled: ldcSettings.enabled,
    leagues: ldcSettings.leagues,
    mappings: loadLeagueMappings(),
    model: ldcSettings.model
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ldc-settings.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function exportLdcMappingsAction(): void {
  const data = {
    mappings: loadLeagueMappings()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ldc-mappings.json';
  a.click();
  URL.revokeObjectURL(url);
}

export async function importLdcMappingsFileAction(
  file: File,
  options: BindImportExportListenersOptions
) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!validateMappingsJSONImpl(data)) {
      showAlertModal(
        'Błąd importu',
        'Nieprawidłowy format pliku JSON. Oczekiwany format: {"mappings": {"source": "target"}} lub {"mappings": {"source": {"name": "target", "nation": "country"}}}.'
      );
      return;
    }

    const existingMappings = loadLeagueMappings();
    const newMappings = normalizeLeagueMappings(data.mappings || {});
    const conflicts = Object.keys(newMappings).filter(
      (key: string) =>
        existingMappings[key] &&
        (existingMappings[key].name !== newMappings[key].name ||
          existingMappings[key].nation !== newMappings[key].nation)
    );

    if (conflicts.length > 0) {
      showConfirmModal(
        'Konflikt mapowań',
        `Znaleziono ${conflicts.length} konfliktujących mapowań. Czy chcesz je nadpisać?`,
        () => {
          const result = mergeMappingsImpl(newMappings, true);
          saveLeagueMappings(result.mappings);
          showAlertModal(
            'Import zakończony',
            `Dodano: ${result.added}\nZaktualizowano: ${result.updated}\nBłędy: ${result.errors}`
          );
          options.onMappingsChanged();
        }
      );
      return;
    }

    const result = mergeMappingsImpl(newMappings, true);
    saveLeagueMappings(result.mappings);

    showAlertModal(
      'Import zakończony',
      `Dodano: ${result.added}\nZaktualizowano: ${result.updated}\nBłędy: ${result.errors}`
    );

    options.onMappingsChanged();
  } catch (error: any) {
    showAlertModal('Błąd importu', `Błąd podczas importu: ${error.message}`);
  }
}

function applyImportedLeagues(
  leagues: any[],
  mappings: LegacyLeagueMappings | null,
  options: BindImportExportListenersOptions
) {
  ldcSettings.leagues = leagues;
  ldcSettings.leagues.forEach((league, index) => (league.rank = index + 1));
  options.calculateLDC();
  updateLDCUI();
  saveLDCSettings();

  if (mappings) {
    saveLeagueMappings(mappings);
  }

  options.onSettingsChanged();
}

export async function importLdcSettingsFileAction(
  file: File,
  options: BindImportExportListenersOptions
) {
  const text = await file.text();
  const isHTML = file.name.endsWith('.html');
  const isJSON = file.name.endsWith('.json');

  let leagues: any[] = [];
  let mappings: LegacyLeagueMappings | null = null;

  if (isJSON) {
    try {
      const result = parseLdcSettingsPayload(JSON.parse(text));
      if (!result.success) {
        showAlertModal('Nieprawidłowe ustawienia LDC', formatLdcValidationError(result.error));
        return;
      }

      const data = result.data;
      // Canonicalize nations from JSON payloads (may carry raw FM codes from
      // exports made before this fix, or hand-edited files) so identity keys
      // and country comparisons stay consistent with the rest of LDC.
      leagues = data.leagues.map((league) => ({
        ...league,
        nation: canonicalizeNation(league.nation)
      }));
      mappings = data.mappings ?? null;
      if (data.enabled !== undefined) ldcSettings.enabled = data.enabled;
      if (data.model !== undefined) ldcSettings.model = data.model;
      if (data.alphaBasket !== undefined) ldcSettings.alphaBasket = data.alphaBasket;
      if (data.alphaSimple !== undefined) ldcSettings.alphaSimple = data.alphaSimple;
      if (data.baseLeague !== undefined) ldcSettings.baseLeague = data.baseLeague;
      if (data.baseLeagueNation !== undefined) {
        ldcSettings.baseLeagueNation = canonicalizeNation(data.baseLeagueNation);
      }
    } catch (error: any) {
      showAlertModal('Błąd importu', `Błąd podczas importu pliku JSON: ${error.message}`);
      return;
    }
  } else {
    leagues = isHTML ? parseLDCHTML(text) : parseLDCCSV(text);
  }

  if (leagues.length === 0) {
    return;
  }

  const defaultLeagues = await loadDefaultLDCData();
  const defaultLeagueKeys = new Set(defaultLeagues.map((league) => leagueKey(league)));
  const hasCustomLeagues = ldcSettings.leagues.some(
    (league) => !defaultLeagueKeys.has(leagueKey(league))
  );

  if (!hasCustomLeagues) {
    applyImportedLeagues(leagues, mappings, options);
    return;
  }

  showConfirmModal(
    'Wykryto wprowadzone ligi',
    'Wykryto wprowadzone przez Ciebie ligi.\n\nKliknij "OK" aby spróbować połączyć je z importowanym plikiem.\nKliknij "Anuluj" aby usunąć wprowadzone ligi i zastąpić je importowanym plikiem.',
    () => {
      const existingLeagueKeys = new Set(ldcSettings.leagues.map((league) => leagueKey(league)));
      const customLeagues = ldcSettings.leagues.filter(
        (league) => !defaultLeagueKeys.has(leagueKey(league))
      );
      const newLeagues = leagues.filter((league) => !existingLeagueKeys.has(leagueKey(league)));

      applyImportedLeagues([...customLeagues, ...newLeagues], mappings, options);
    },
    () => {
      applyImportedLeagues(leagues, mappings, options);
    }
  );
}
