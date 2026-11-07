/* eslint-disable sonarjs/max-lines-per-function, sonarjs/cognitive-complexity, no-useless-assignment, unicorn/consistent-function-scoping -- Legacy scoring pipeline extracted from DataProcessor; slated for later decomposition. */
import { applyLDCToStats, restoreOriginalStats } from '../computing/ldc';
import { ATTRIBUTE_COEFFS, POSITION_FILTERS, STATS_CONFIG } from '../config/scoreConfig';
import { useSettingsStore } from '../store/useSettingsStore';

import {
  buildPlayerBestRoleDetails,
  inferMostCommonPrimaryRole,
  normalizeRoleScoresMap
} from './bestRoleSelection';
import { calculateMarketEfficiency } from './calculateMarketEfficiency';
import { type CleanValueFn } from './cleanValue';
import { computeAttributeScore } from './computeAttributeScore';
import { computeStatScore } from './computeStatScore';
import { ensureRoleDistributions } from './roleDistributions';
import {
  applyBestRoleViewScores,
  applySelectedRoleBestScores,
  buildCalculatedScoreEntry
} from './scorePostProcessing';

interface CalculateScoresParams {
  calculateScoresForAllRoles: (engine: string) => any;
  cleanValue: CleanValueFn;
  deriveStats: (player: any) => void;
  engine: string;
  filterDistributionCache: Map<any, any>;
  isFirstCalculation: boolean;
  mergedData: any[];
  position: string;
  statDistributionCache: Map<any, any>;
}

interface CalculateScoresResult {
  calculatedScores: any[];
  isFirstCalculation: boolean;
}

export function calculateScoresData(params: CalculateScoresParams): CalculateScoresResult {
  const {
    engine,
    position,
    mergedData,
    cleanValue,
    deriveStats,
    calculateScoresForAllRoles,
    filterDistributionCache,
    statDistributionCache
  } = params;
  let isFirstCalculation = params.isFirstCalculation;

  if (!position) return { calculatedScores: [], isFirstCalculation };

  if (isFirstCalculation) {
    const playersWithMins = mergedData.filter((p) => {
      const mins = cleanValue(p.Mins) as null | number;
      return mins !== null && mins > 0;
    });

    if (playersWithMins.length > 0) {
      const maxMins = Math.max(...playersWithMins.map((p) => cleanValue(p.Mins) as number));
      const baseThreshold = maxMins * 0.3;
      const computedThreshold = Math.max(135, Math.min(540, baseThreshold));
      const currentMinMins = useSettingsStore.getState().settings.minMins;
      useSettingsStore.getState().applySettings({
        adaptiveMinMins: computedThreshold,
        minMins: currentMinMins === null ? computedThreshold : currentMinMins
      });
    }

    isFirstCalculation = false;
  }

  const { adaptiveMinMins, minMins } = useSettingsStore.getState().settings;
  const threshold = minMins === null ? adaptiveMinMins || null : minMins;

  if (threshold === null) {
    console.warn(
      'No minimum minutes threshold set. Please set a threshold or load data to calculate adaptive threshold.'
    );
  }

  for (const mergedDatum of mergedData) {
    // Restore raw values first so derivations never read LDC-adjusted
    // inputs and stale *_original fields cannot cause double adjustment.
    restoreOriginalStats(mergedDatum);
    deriveStats(mergedDatum);
    applyLDCToStats(mergedDatum);
  }

  let actualPosition = position;
  let bestRoleMap = null;
  let playerBestRoles = null;
  if (position === 'BEST') {
    bestRoleMap = calculateScoresForAllRoles(engine);
    normalizeRoleScoresMap({
      normalizeAttr: useSettingsStore.getState().settings.normalizeAttr,
      normalizeStat: useSettingsStore.getState().settings.normalizeStat,
      normalizeTotal: useSettingsStore.getState().settings.normalizeTotal,
      roleScoresMap: bestRoleMap
    });
    playerBestRoles = buildPlayerBestRoleDetails(bestRoleMap);
    actualPosition = inferMostCommonPrimaryRole(playerBestRoles);
  }

  const keyStats = STATS_CONFIG[actualPosition] || [];
  const { statDist } = ensureRoleDistributions({
    cleanValue,
    filterDistributionCache,
    keyStats,
    mergedData,
    role: actualPosition,
    statDistributionCache
  });
  const coeffs = ATTRIBUTE_COEFFS[engine][actualPosition] || {};
  const reqAttrKeys = Object.keys(coeffs);
  const filters = POSITION_FILTERS[actualPosition] || {};

  const calculatedScores: any[] = mergedData.map((p) => {
    const mins = (cleanValue(p.Mins) as null | number) ?? 0;
    const {
      aD,
      aScore,
      missingAttrCount,
      rangeAttrCount,
      totalAttrWeight: aW
    } = computeAttributeScore(p, coeffs, cleanValue);
    const isLow = threshold !== null && mins < threshold;
    const {
      sD,
      sScore,
      missingStatCount,
      rangeStatCount,
      totalStatWeight: sW
    } = computeStatScore(p, keyStats, { isLow, position: actualPosition, statDist }, cleanValue);
    const name = p.basic_name || p.Name || p.Nazwisko || p['Nazwisko i imię'] || 'Unknown';
    const club = p.basic_club || p.Club || p.Klub || '-';
    const league = p.basic_division || p.Division || p.Liga || '-';
    const playerPosition = p.basic_position || p.Position || p.Pozycja || '-';

    return buildCalculatedScoreEntry({
      attrDetails: aD,
      attrScore: aScore,
      cleanValue,
      club,
      coeffKeys: reqAttrKeys,
      filters,
      isLow,
      league,
      mins,
      missingAttrCount,
      missingStatCount,
      name,
      player: p,
      playerPosition,
      rangeAttrCount,
      rangeStatCount,
      statDetails: sD,
      statScore: sScore,
      totalAttrWeight: aW,
      totalStatWeight: sW
    });
  });

  if (position === 'BEST' && playerBestRoles) {
    applyBestRoleViewScores({
      calculatedScores,
      cleanValue,
      playerBestRoles,
      positionFilters: POSITION_FILTERS
    });
  } else if (position !== 'BEST') {
    const allScores = calculateScoresForAllRoles(engine);
    normalizeRoleScoresMap({
      normalizeAttr: useSettingsStore.getState().settings.normalizeAttr,
      normalizeStat: useSettingsStore.getState().settings.normalizeStat,
      normalizeTotal: useSettingsStore.getState().settings.normalizeTotal,
      roleScoresMap: allScores
    });
    const allPlayerBestRoles = buildPlayerBestRoleDetails(allScores);
    applySelectedRoleBestScores({
      actualPosition,
      allPlayerBestRoles,
      allScores,
      calculatedScores
    });
  }

  const filterTotalRatio = (p: any) => !p.isLow && !p.hasManyMissing;
  const filterStatRatio = (p: any) => !p.isLow;
  const filterAttrRatio = (p: any) => !p.hasManyMissing;

  const calculateRatiosForType = (scoreKey: string, filterFn: (p: any) => boolean) => {
    const tempPlayers = calculatedScores.map((p, index) => ({ ...p, tempIndex: index }));
    tempPlayers.sort((a, b) => (a[scoreKey] || 0) - (b[scoreKey] || 0));
    const valueEfficiencyMap = calculateMarketEfficiency(
      tempPlayers,
      'Transfer Value',
      40,
      scoreKey,
      filterFn
    );
    const wageEfficiencyMap = calculateMarketEfficiency(
      tempPlayers,
      'Wage',
      40,
      scoreKey,
      filterFn
    );
    return { valueMap: valueEfficiencyMap, wageMap: wageEfficiencyMap };
  };

  const totalRatios = calculateRatiosForType('totalScore', filterTotalRatio);
  const statRatios = calculateRatiosForType('statScore', filterStatRatio);
  const atrRatios = calculateRatiosForType('attrScore', filterAttrRatio);

  for (const [i, p] of calculatedScores.entries()) {
    const vDataTotal = totalRatios.valueMap.get(i);
    const wDataTotal = totalRatios.wageMap.get(i);
    p.scorePerValue = vDataTotal ? vDataTotal.ratio : null;
    p.scorePerWage = wDataTotal ? wDataTotal.ratio : null;
    p.xValue = vDataTotal ? Math.max(0, vDataTotal.expected) : null;
    p.xWage = wDataTotal ? Math.max(0, wDataTotal.expected) : null;

    const vDataStat = statRatios.valueMap.get(i);
    const wDataStat = statRatios.wageMap.get(i);
    p.scorePerValueStat = vDataStat ? vDataStat.ratio : null;
    p.scorePerWageStat = wDataStat ? wDataStat.ratio : null;

    const vDataAtr = atrRatios.valueMap.get(i);
    const wDataAtr = atrRatios.wageMap.get(i);
    p.scorePerValueAtr = vDataAtr ? vDataAtr.ratio : null;
    p.scorePerWageAtr = wDataAtr ? wDataAtr.ratio : null;

    if (p.scorePerValue === null) {
      p.valueRating = null;
    } else {
      if (p.scorePerValue >= 1.5) p.valueRating = 'niedoceniony';
      else if (p.scorePerValue <= 0.6) p.valueRating = 'przeceniony';
      else p.valueRating = 'fair';
    }

    if (p.scorePerWage === null) {
      p.wageRating = null;
    } else {
      if (p.scorePerWage >= 1.5) p.wageRating = 'niedoceniony';
      else if (p.scorePerWage <= 0.6) p.wageRating = 'przeceniony';
      else p.wageRating = 'fair';
    }
  }

  const vA: number[] = [];
  const vS: number[] = [];
  for (const x of calculatedScores) {
    if (x.dataCategory !== 'Brak/niepełne statystyki') vS.push(x.statScore);
    vA.push(x.attrScore);
  }
  vS.sort((a, b) => a - b);
  vA.sort((a, b) => a - b);

  const pct = useSettingsStore.getState().settings.percentile / 100;
  const pA = vA[Math.floor(vA.length * pct)] || 0;
  const pS = vS[Math.floor(vS.length * pct)] || 0;
  for (const p of calculatedScores) {
    if (p.statScore >= pS && p.attrScore >= pA) p.suggestion = 'Kup';
    else if (p.statScore >= pS && p.dataCategory !== 'Pełne dane') p.suggestion = 'Scoutuj';
    else if (p.attrScore >= pA && p.statScore < pS) p.suggestion = 'Śledź';
    else p.suggestion = 'Pomiń';
  }

  return { calculatedScores, isFirstCalculation };
}
