import {
  applyLDCToStats,
  loadDefaultLDCData,
  restoreOriginalStats,
  saveLeagueMappings
} from '@/computing/ldc';
import { resolveMappingTargetLeague } from '@/computing/ldcMappings';
import { ldcSettings } from '@/config/ldcConfig';
import { detectMissingLeagues } from '@/features/ldc/detectMissingLeagues';
import { assessLdcDataAvailability } from '@/features/ldc/ldcDataAvailability';
import { useLdcStore } from '@/features/ldc/useLdcStore';
import { t } from '@/i18n';
import { rerunCurrentAnalysis } from '@/lib/legacyActionBridge';
import { getPlayerRuntimeRows } from '@/lib/playerRuntimeCache';
import { getProcessor } from '@/lib/processorBridge';
import { scheduleTableRender } from '@/lib/uiBridge';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';

import { calculateLDC } from './ldcModalCalculation';
import { showAlertModal, showConfirmModalAsync } from './ldcModalHelpers';
import { saveLDCSettings, updateLDCUI } from './ldcSettings';

async function confirmLdcDataReadiness(): Promise<boolean> {
  const baseLeague = resolveMappingTargetLeague(
    { name: ldcSettings.baseLeague, nation: ldcSettings.baseLeagueNation ?? '' },
    ldcSettings.leagues
  );
  if (baseLeague === null) {
    const proceed = await showConfirmModalAsync(
      t('ldc_apply_invalid_base_title'),
      t('ldc_apply_invalid_base_msg', 'ui', { baseLeague: ldcSettings.baseLeague })
    );
    if (!proceed) {
      return false;
    }
  }

  const availability = assessLdcDataAvailability(getPlayerRuntimeRows());
  if (availability.playersTotal > 0 && availability.playersWithDivision === 0) {
    return showConfirmModalAsync(t('ldc_apply_no_division_title'), t('ldc_apply_no_division_msg'));
  }
  if (availability.playersTotal > 0 && availability.playersWithNation === 0) {
    return showConfirmModalAsync(t('ldc_apply_no_nation_title'), t('ldc_apply_no_nation_msg'));
  }

  const missingLeagues = detectMissingLeagues();
  if (missingLeagues.length > 0) {
    return showConfirmModalAsync(
      t('ldc_apply_missing_leagues_title'),
      t('ldc_apply_missing_leagues_msg', 'ui', { count: missingLeagues.length })
    );
  }

  return true;
}

export async function applyLdcChangesAction(): Promise<void> {
  if (ldcSettings.enabled && !(await confirmLdcDataReadiness())) {
    return;
  }

  await useLdcStore.getState().commitEditSession();
  closeLDCModal();

  const processor = getProcessor();
  if (!processor?.mergedData?.length) {
    return;
  }

  processor.mergedData.forEach((player: any) => {
    restoreOriginalStats(player);
    processor.deriveStats(player);
    applyLDCToStats(player);
  });

  if (processor.calculatedScores.length > 0) {
    rerunCurrentAnalysis();
  }

  scheduleTableRender();
}

export function closeLDCModal(): void {
  useWorkspaceStore.getState().closeLdc();
}

export async function resetLdcSettingsAction(): Promise<void> {
  const confirmed = await showConfirmModalAsync(
    t('ldc_reset_confirm_title'),
    t('ldc_reset_confirm_msg')
  );
  if (!confirmed) {
    return;
  }

  const removeCustom = await showConfirmModalAsync(
    t('ldc_reset_mappings_title'),
    t('ldc_reset_mappings_msg')
  );

  ldcSettings.enabled = false;
  ldcSettings.model = 'basket';
  ldcSettings.alphaBasket = 1.7;
  ldcSettings.alphaSimple = 5.3;
  ldcSettings.baseLeague = 'Premier League';
  ldcSettings.baseLeagueNation = 'Anglia';
  ldcSettings.leagues = await loadDefaultLDCData();
  if (ldcSettings.leagues.length === 0) {
    showAlertModal(t('ldc_load_error_title'), t('ldc_load_error_msg'));
  }
  ldcSettings.leagues.forEach((league, index) => (league.rank = index + 1));

  if (removeCustom) {
    saveLeagueMappings({});
  }

  calculateLDC();
  updateLDCUI();
  await saveLDCSettings();
  await useLdcStore.getState().syncFromLegacy();
}
