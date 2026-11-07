/* eslint-disable @typescript-eslint/no-floating-promises, @typescript-eslint/no-misused-promises -- Legacy LDC modal actions still bridge DOM-owned inputs and mutable singleton settings. */

import { loadDefaultLDCData } from '../computing/ldc';
import { ldcSettings } from '../config/ldcConfig';

import { showAlertModal, showConfirmModal } from './ldcModalHelpers';
import { saveLDCSettings } from './ldcSettings';

interface AttachLoadDefaultButtonOptions {
  calculateLDC: () => void;
  onSettingsChanged: () => void;
}

export async function loadDefaultLeaguesAction(
  options: AttachLoadDefaultButtonOptions
): Promise<void> {
  return new Promise((resolve) => {
    showConfirmModal(
      'Załaduj domyślny spis lig',
      'Czy na pewno chcesz załadować domyślny spis lig? Obecna lista lig zostanie zastąpiona.',
      async () => {
        try {
          const defaultLeagues = await loadDefaultLDCData();

          if (defaultLeagues.length === 0) {
            showAlertModal(
              'Błąd',
              'Nie udało się załadować domyślnych lig. Sprawdź konsolę przeglądarki (F12).'
            );
            resolve();
            return;
          }

          ldcSettings.leagues = defaultLeagues;
          ldcSettings.leagues.forEach((league, index) => (league.rank = index + 1));
          options.calculateLDC();
          saveLDCSettings();
          options.onSettingsChanged();
          showAlertModal('Sukces', `Załadowano ${defaultLeagues.length} lig z domyślnego spisu.`);
        } catch (error: any) {
          console.error('Error loading default leagues:', error);
          showAlertModal(
            'Błąd',
            `Błąd podczas ładowania domyślnych lig: ${
              error.message
            }\n\nSprawdź konsolę przeglądarki (F12) dla szczegółów.`
          );
          if ((window as any).addAudit) {
            (window as any).addAudit('ldc_load_default_error', { error: String(error) }, 'error');
          }
        } finally {
          resolve();
        }
      },
      () => {
        resolve();
      }
    );
  });
}
