import type { BestRoleDetails } from './bestRoleSelection';
import type { ScoreEntry } from './calculateScoresForAllRoles';

interface PositionFilterLimit {
  max?: number;
}

interface StatDetailLike {
  name: string;
  skipped?: boolean;
}

interface PlayerLike {
  [key: string]: any;
  age?: any;
  attrScore?: number;
  bestRole?: BestRoleDetails;
  bestRoleAttr?: { role: string; score: number };
  bestRoleStat?: { role: string; score: number };
  bestRoleTotal?: { role: string; score: number };
  dataCategory?: string;
  filters?: FilterResult[];
  foot?: any;
  hasAnyRange?: boolean;
  hasManyMissing?: boolean;
  hasMissingAttrs?: boolean;
  hasMissingStats?: boolean;
  hasRangeAttrs?: boolean;
  hasRangeStats?: boolean;
  isLow?: boolean;
  league?: any;
  mins?: number;
  name?: string;
  passesFilters?: boolean;
  position?: any;
  scorePerValue?: null | number;
  scorePerValueAtr?: null | number;
  scorePerValueStat?: null | number;
  scorePerWage?: null | number;
  scorePerWageAtr?: null | number;
  scorePerWageStat?: null | number;
  shouldItalicizeAttrScore?: boolean;
  shouldItalicizeStatScore?: boolean;
  statDetails?: StatDetailLike[];
  statScore?: number;
  totalScore?: number;
  uid: any;
  value?: any;
  wage?: any;
}

export interface FilterResult {
  limit: string;
  name: string;
  passed: boolean;
  skipped: boolean;
  val: string;
}

interface BuildFilterResultsArgs {
  cleanValue: (value: unknown) => any;
  filters: Record<string, number | PositionFilterLimit>;
  ignoreSkippedFailures?: boolean;
  player: PlayerLike;
}

interface ApplyBestRoleViewScoresArgs {
  calculatedScores: PlayerLike[];
  cleanValue: (value: unknown) => any;
  playerBestRoles: Map<any, BestRoleDetails>;
  positionFilters: Record<string, Record<string, number | PositionFilterLimit>>;
}

interface ApplySelectedRoleBestScoresArgs {
  actualPosition: string;
  allPlayerBestRoles: Map<any, BestRoleDetails>;
  allScores: Map<any, ScoreEntry[]>;
  calculatedScores: PlayerLike[];
}

interface BuildCalculatedScoreEntryArgs {
  attrDetails: any[];
  attrScore: number;
  cleanValue: (value: unknown) => any;
  club: string;
  coeffKeys: string[];
  filters: Record<string, number | PositionFilterLimit>;
  isLow: boolean;
  league: string;
  mins: number;
  missingAttrCount: number;
  missingStatCount: number;
  name: string;
  player: PlayerLike;
  playerPosition: string;
  rangeAttrCount: number;
  rangeStatCount: number;
  statDetails: any[];
  statScore: number;
  totalAttrWeight: number;
  totalStatWeight: number;
}

function getFilterDescriptor(limit: number | PositionFilterLimit, value: number) {
  if (typeof limit === 'object' && limit.max) {
    return {
      passed: value <= limit.max,
      text: `max ${limit.max}`
    };
  }

  if (typeof limit === 'number') {
    return {
      passed: value >= limit,
      text: `min ${limit}`
    };
  }

  return {
    passed: false,
    text: 'min 0'
  };
}

function isSkippedStat(player: PlayerLike, statName: string) {
  const statDetails = player.statDetails;
  if (!statDetails || !Array.isArray(statDetails)) {
    return false;
  }

  const statDetail = statDetails.find((detail) => detail.name === statName);
  return Boolean(statDetail?.skipped);
}

export function buildFilterResults({
  cleanValue,
  filters,
  ignoreSkippedFailures = false,
  player
}: BuildFilterResultsArgs) {
  let passesFilters = true;
  const filterResults: FilterResult[] = [];

  for (const [name, limit] of Object.entries(filters)) {
    const value = cleanValue(player[name]) || 0;
    const skipped = isSkippedStat(player, name);
    const descriptor = getFilterDescriptor(limit, value);

    if (!descriptor.passed && !(ignoreSkippedFailures && skipped)) {
      passesFilters = false;
    }

    filterResults.push({
      limit: descriptor.text,
      name,
      passed: skipped ? false : descriptor.passed,
      skipped,
      val: skipped ? '-' : value.toFixed(2)
    });
  }

  return { filterResults, passesFilters };
}

export function applyBestRoleViewScores({
  calculatedScores,
  cleanValue,
  playerBestRoles,
  positionFilters
}: ApplyBestRoleViewScoresArgs) {
  for (const player of calculatedScores) {
    const bestRole = playerBestRoles.get(player.uid);

    if (!bestRole) {
      continue;
    }

    player.totalScore = bestRole.totalScore;
    player.statScore = bestRole.statScore;
    player.attrScore = bestRole.attrScore;
    player.bestRole = bestRole;

    const primaryBestRole = bestRole.role.split('/')[0];
    const bestRoleFilters = positionFilters[primaryBestRole] || {};
    const { filterResults, passesFilters } = buildFilterResults({
      cleanValue,
      filters: bestRoleFilters,
      ignoreSkippedFailures: true,
      player
    });

    player.passesFilters = passesFilters;
    player.filters = filterResults;
  }
}

export function applySelectedRoleBestScores({
  actualPosition,
  allPlayerBestRoles,
  allScores,
  calculatedScores
}: ApplySelectedRoleBestScoresArgs) {
  for (const player of calculatedScores) {
    const scores = allScores.get(player.uid);
    const bestRole = allPlayerBestRoles.get(player.uid);

    if (!scores || scores.length === 0 || !bestRole) {
      continue;
    }

    player.bestRoleTotal = { role: bestRole.totalRole, score: bestRole.totalScore };
    player.bestRoleStat = { role: bestRole.statRole, score: bestRole.statScore };
    player.bestRoleAttr = { role: bestRole.attrRole, score: bestRole.attrScore };

    const selectedRoleScore = scores.find((score) => score.role === actualPosition);
    if (selectedRoleScore) {
      player.totalScore = selectedRoleScore.totalScore;
      player.statScore = selectedRoleScore.statScore;
      player.attrScore = selectedRoleScore.attrScore;
    }
  }
}

function inferDataCategory({
  coeffKeys,
  isLow,
  missingAttrCount,
  missingStatCount,
  rangeAttrCount,
  statDetails
}: {
  coeffKeys: string[];
  isLow: boolean;
  missingAttrCount: number;
  missingStatCount: number;
  rangeAttrCount: number;
  statDetails: any[];
}) {
  const hasAnyAttr = coeffKeys.length > 0 && missingAttrCount < coeffKeys.length;
  const hasAnyStat = !isLow && missingStatCount < statDetails.length;

  if (!hasAnyAttr && !hasAnyStat) {
    return 'Brak danych';
  }
  if (hasAnyAttr && (!hasAnyStat || missingStatCount > 0)) {
    return 'Brak/niepełne statystyki';
  }
  if (hasAnyStat && missingAttrCount > 0) {
    return 'Brak/mało atrybutów';
  }
  if (rangeAttrCount > 0 && missingAttrCount === 0) {
    return 'Zakresy/niepełne atrybuty';
  }

  return 'Pełne dane';
}

function resolveTotalScore(
  attrScore: number,
  statScore: number,
  totalAttrWeight: number,
  totalStatWeight: number
) {
  if (totalAttrWeight > 0 && totalStatWeight > 0) {
    return (attrScore + statScore) / 2;
  }
  if (totalAttrWeight > 0) {
    return attrScore;
  }
  if (totalStatWeight > 0) {
    return statScore;
  }

  return 0;
}

function resolveDisplayValue(player: PlayerLike) {
  return (
    player.basic_transfer_value_display ||
    player['Transfer Value'] ||
    player['Wartość'] ||
    player.basic_transfer_value
  );
}

function resolveDisplayWage(player: PlayerLike) {
  return player.basic_wage_display || player.Wage || player['Płaca'] || player.basic_wage;
}

export function buildCalculatedScoreEntry({
  attrDetails,
  attrScore,
  cleanValue,
  club,
  coeffKeys,
  filters,
  isLow,
  league,
  mins,
  missingAttrCount,
  missingStatCount,
  name,
  player,
  playerPosition,
  rangeAttrCount,
  rangeStatCount,
  statDetails,
  statScore,
  totalAttrWeight,
  totalStatWeight
}: BuildCalculatedScoreEntryArgs) {
  const dataCategory = inferDataCategory({
    coeffKeys,
    isLow,
    missingAttrCount,
    missingStatCount,
    rangeAttrCount,
    statDetails
  });
  const hasManyMissing = coeffKeys.length > 0 && missingAttrCount / coeffKeys.length >= 0.3;
  const hasRangeAttrs = rangeAttrCount > 0;
  const hasMissingAttrs = missingAttrCount > 0;
  const hasRangeStats = rangeStatCount > 0;
  const hasMissingStats = missingStatCount > 0;
  const hasAnyRange = hasRangeAttrs || hasRangeStats;
  const shouldItalicizeAttrScore = hasRangeAttrs || hasMissingAttrs;
  const shouldItalicizeStatScore = hasRangeStats || hasMissingStats;
  const { filterResults, passesFilters } = buildFilterResults({
    cleanValue,
    filters,
    player: { ...player, statDetails }
  });
  const totalScore = resolveTotalScore(attrScore, statScore, totalAttrWeight, totalStatWeight);

  return {
    ...player,
    age: player.basic_age || player.Age || player.Wiek || 0,
    attrDetails,
    attrScore,
    club,
    dataCategory,
    filters: filterResults,
    foot: player.basic_preferred_foot || player['Preferred Foot'],
    hasAnyRange,
    hasManyMissing,
    hasMissingAttrs,
    hasMissingStats,
    hasRangeAttrs,
    hasRangeStats,
    isLow,
    league,
    mins,
    name,
    passesFilters,
    pos2: player['Sec. Position'],
    pos2Array: player.pos2Array || [],
    position: playerPosition,
    positionArray: player.positionArray || [],
    scorePerValue: null,
    scorePerValueAtr: null,
    scorePerValueStat: null,
    scorePerWage: null,
    scorePerWageAtr: null,
    scorePerWageStat: null,
    shouldItalicizeAttrScore,
    shouldItalicizeStatScore,
    statDetails,
    statScore,
    totalScore,
    uid: player.UID || player.basic_uid,
    value: resolveDisplayValue(player),
    wage: resolveDisplayWage(player)
  };
}
