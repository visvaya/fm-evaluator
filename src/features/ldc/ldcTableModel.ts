/* eslint-disable fp/no-mutation -- Shared LDC computation cache is intentionally mutable across React and legacy compat render paths. */

import {
  createLeagueIdentityKey,
  getMappingTarget,
  getMappingTargetName,
  getMappingTargetNation,
  loadLeagueMappings,
  resolveMappingTargetLeague
} from '@/computing/ldcMappings';
import { canonicalizeNation } from '@/computing/ldcNations';
import {
  formatLdcRaw,
  formatMultiplier,
  getLeaguesHash,
  getOptimalLdcRawPrecision,
  getOptimalMultiplierPrecision,
  getPlayerDataHash,
  isFreeAgent,
  normalizeLeagueNameForGrouping,
  validateLeague
} from '@/computing/ldcUtils';
import { ldcComputationCache } from '@/config/ldcConfig';
import { getPlayerRuntimeRows } from '@/lib/playerRuntimeCache';

import type { LdcLeagueFilter } from './useLdcStore';
import type { LdcSortColumn, LDCSettings, LeagueData } from '@/config/ldcConfig';

export interface LdcLeagueRowViewModel {
  errorClassName: string;
  errorIconTitle: string;
  hasErrors: boolean;
  inputScoreText: string;
  isMatched: boolean;
  ldcRawText: string;
  ldcRawTooltip: string;
  league: LeagueData;
  multiplierText: string;
  multiplierTooltip: string;
  originalIndex: number;
  rowId: string;
  validationErrors: string[];
}

function getMatchedLeagues(settings: LDCSettings) {
  const mappings = loadLeagueMappings();
  const playerDataHash = `${getPlayerDataHash()}::${getLeaguesHash(settings.leagues)}::${JSON.stringify(mappings)}`;
  if (
    ldcComputationCache.matchedLeaguesHash === playerDataHash &&
    ldcComputationCache.matchedLeagues
  ) {
    return ldcComputationCache.matchedLeagues;
  }

  const matchedLeagues = new Set<string>();
  const playerRows = getPlayerRuntimeRows();
  if (playerRows.length > 0) {
    const playerLeagueKeys = new Set<string>();
    const playerLeagueNamesWithoutNation = new Set<string>();

    playerRows.forEach((player) => {
      const division = player.Division;
      if (!division || isFreeAgent(division)) {
        return;
      }

      // Based In is the league's country; Nation is the player's nationality
      // and must never stand in for it (scoring only ever reads Based In).
      const playerNation = canonicalizeNation(String(player['Based In'] || ''));
      const mappedTarget = getMappingTarget(mappings, division, playerNation);
      const mappedLeague = resolveMappingTargetLeague(mappedTarget, settings.leagues);
      if (mappedLeague) {
        playerLeagueKeys.add(createLeagueIdentityKey(mappedLeague.name, mappedLeague.nation));
        return;
      }

      const mappedName = getMappingTargetName(mappedTarget);
      if (mappedName) {
        const mappedNation = getMappingTargetNation(mappedTarget);
        if (mappedNation) {
          playerLeagueKeys.add(createLeagueIdentityKey(mappedName, mappedNation));
        } else {
          playerLeagueNamesWithoutNation.add(normalizeLeagueNameForGrouping(mappedName));
        }
        return;
      }

      const normalizedDivision = normalizeLeagueNameForGrouping(division);
      if (playerNation) {
        playerLeagueKeys.add(createLeagueIdentityKey(division, playerNation));
        playerLeagueKeys.add(createLeagueIdentityKey(normalizedDivision, playerNation));
      } else {
        playerLeagueNamesWithoutNation.add(normalizedDivision);
      }
    });

    const leagueNameCounts = new Map<string, number>();
    settings.leagues.forEach((league) => {
      const normalizedName = normalizeLeagueNameForGrouping(league.name);
      leagueNameCounts.set(normalizedName, (leagueNameCounts.get(normalizedName) ?? 0) + 1);
    });

    settings.leagues.forEach((league) => {
      const normalizedName = normalizeLeagueNameForGrouping(league.name);
      const isMatchedByIdentity =
        playerLeagueKeys.has(createLeagueIdentityKey(league.name, league.nation)) ||
        playerLeagueKeys.has(createLeagueIdentityKey(normalizedName, league.nation));
      const isUniqueUnscopedMatch =
        leagueNameCounts.get(normalizedName) === 1 &&
        playerLeagueNamesWithoutNation.has(normalizedName);

      if (isMatchedByIdentity || isUniqueUnscopedMatch) {
        matchedLeagues.add(createLeagueIdentityKey(league.name, league.nation));
      }
    });
  }

  ldcComputationCache.matchedLeagues = matchedLeagues;
  ldcComputationCache.matchedLeaguesHash = playerDataHash;
  return matchedLeagues;
}

function getPrecisions(settings: LDCSettings) {
  const leaguesHash = getLeaguesHash(settings.leagues);
  if (
    ldcComputationCache.precision.leaguesHash === leaguesHash &&
    ldcComputationCache.precision.ldcRaw !== null &&
    ldcComputationCache.precision.multiplier !== null
  ) {
    return {
      ldcRawPrecision: ldcComputationCache.precision.ldcRaw,
      multiplierPrecision: ldcComputationCache.precision.multiplier
    };
  }

  const ldcRawPrecision = getOptimalLdcRawPrecision(settings.leagues);
  const multiplierPrecision = getOptimalMultiplierPrecision(settings.leagues);
  ldcComputationCache.precision = {
    ldcRaw: ldcRawPrecision,
    leaguesHash,
    multiplier: multiplierPrecision
  };

  return {
    ldcRawPrecision,
    multiplierPrecision
  };
}

function compareNullableNumbers(left: null | number, right: null | number) {
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return left - right;
}

function compareLeagues(left: LeagueData, right: LeagueData, sortColumn: LdcSortColumn) {
  switch (sortColumn) {
    case 'inputScore': {
      return left.inputScore - right.inputScore;
    }
    case 'ldcRaw': {
      return left.ldcRaw - right.ldcRaw;
    }
    case 'multiplier': {
      return left.multiplier - right.multiplier;
    }
    case 'name': {
      return left.name.localeCompare(right.name);
    }
    case 'nation': {
      return left.nation.localeCompare(right.nation);
    }
    case 'rank': {
      return left.rank - right.rank;
    }
    case 'stars': {
      return compareNullableNumbers(left.stars, right.stars);
    }
    default: {
      return left.rank - right.rank;
    }
  }
}

function matchesLeagueFilter(
  league: LeagueData,
  filter: LdcLeagueFilter,
  mappedLeagueKeys: ReadonlySet<string>,
  originalIndex: number
) {
  const leagueKey = createLeagueIdentityKey(league.name, league.nation);

  if (filter === 'all') {
    return true;
  }

  if (filter === 'with-mappings') {
    return mappedLeagueKeys.has(leagueKey);
  }

  if (filter === 'without-mappings') {
    return !mappedLeagueKeys.has(leagueKey);
  }

  if (filter === 'without-stars') {
    return league.stars === null;
  }

  return validateLeague(league, originalIndex).length > 0;
}

export function buildLdcLeagueRows(
  settings: LDCSettings,
  searchTerm: string,
  leagueFilter: LdcLeagueFilter,
  showLdcRaw = false
) {
  const normalizedSearchTerm = searchTerm.toLowerCase();
  const originalIndices = new Map(
    settings.leagues.map((league, index) => [league.id ?? league.name, index])
  );
  const mappings = loadLeagueMappings();
  const mappedLeagueKeys = new Set(
    Object.values(mappings)
      .filter((target) => target.nation.trim().length > 0)
      .map((target) => createLeagueIdentityKey(target.name, target.nation))
  );
  const sortFactor = settings.sortDirection === 'desc' ? -1 : 1;
  const sortedLeagues = settings.leagues.toSorted((left, right) => {
    const primary = compareLeagues(left, right, settings.sortColumn);
    if (primary !== 0) {
      return primary * sortFactor;
    }

    return (left.rank - right.rank) * sortFactor;
  });
  const filteredLeagues = sortedLeagues.filter((league) => {
    const originalIndex = originalIndices.get(league.id ?? league.name) ?? -1;
    const matchesSearch =
      !normalizedSearchTerm ||
      league.name.toLowerCase().includes(normalizedSearchTerm) ||
      league.nation?.toLowerCase().includes(normalizedSearchTerm);

    return (
      matchesSearch && matchesLeagueFilter(league, leagueFilter, mappedLeagueKeys, originalIndex)
    );
  });

  const { ldcRawPrecision: rawPrec, multiplierPrecision: multPrec } = getPrecisions(settings);
  const ldcRawPrecision = Math.min(rawPrec, 3);
  const multiplierPrecision = Math.max(3, multPrec);
  const baseLeague = resolveMappingTargetLeague(
    { name: settings.baseLeague, nation: settings.baseLeagueNation ?? '' },
    settings.leagues
  );
  const baseLDC = baseLeague ? baseLeague.ldcRaw : 1;
  const alpha = settings.model === 'basket' ? settings.alphaBasket : settings.alphaSimple;
  const matchedLeagues = getMatchedLeagues(settings);

  return filteredLeagues.map<LdcLeagueRowViewModel>((league) => {
    const originalIndex = originalIndices.get(league.id ?? league.name) ?? -1;
    const validationErrors = validateLeague(league, originalIndex);
    const hasErrors = validationErrors.length > 0;

    return {
      errorClassName: hasErrors ? 'border-red-500 bg-red-50' : '',
      errorIconTitle: validationErrors.join('; '),
      hasErrors,
      inputScoreText: league.inputScore.toFixed(2),
      isMatched: matchedLeagues.has(createLeagueIdentityKey(league.name, league.nation)),
      league,
      ldcRawText: formatLdcRaw(league.ldcRaw, ldcRawPrecision),
      ldcRawTooltip: `LDC_raw = (InputScore/100)^α = (${league.inputScore.toFixed(2)}/100)^${alpha} = ${formatLdcRaw(league.ldcRaw, ldcRawPrecision)}`,
      multiplierText: formatMultiplier(league.multiplier, multiplierPrecision),
      multiplierTooltip: showLdcRaw
        ? `Multiplier = LDC_raw / BaseLDC = ${formatLdcRaw(league.ldcRaw, ldcRawPrecision)} / ${formatLdcRaw(baseLDC, ldcRawPrecision)} = ${formatMultiplier(league.multiplier, multiplierPrecision)}`
        : `LDC_raw: ${formatLdcRaw(league.ldcRaw, ldcRawPrecision)} · Multiplier = LDC_raw / BaseLDC = ${formatLdcRaw(league.ldcRaw, ldcRawPrecision)} / ${formatLdcRaw(baseLDC, ldcRawPrecision)} = ${formatMultiplier(league.multiplier, multiplierPrecision)}`,
      originalIndex,
      rowId: league.id ?? `league-${originalIndex}`,
      validationErrors
    };
  });
}
