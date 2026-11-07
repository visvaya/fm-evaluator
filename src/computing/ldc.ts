/* eslint-disable fp/no-let, fp/no-mutation, fp/no-mutating-methods, sonarjs/cognitive-complexity, sonarjs/no-nested-conditional -- Legacy LDC computation core remains intentionally imperative while being split into smaller modules. */

/**
 * LDC core computation – extracted from main.js (Phase 4).
 * Core calculation, data loading, and mapping cache.
 */
import { type LeagueData, ldcCache, ldcSettings } from '../config/ldcConfig';

import { createLeagueIdentityKey, resolveMappingTargetLeague } from './ldcMappings';
import { normalizeLeagueNameForGrouping } from './ldcUtils';

declare global {
  interface Window {
    addAudit?: (...args: any[]) => void;
    DEFAULT_LEAGUE_DATA: any;
    ldcStorage: any;
    location: Location;
  }
}

// ---------------------------------------------------------------------------
// Core Computation
// ---------------------------------------------------------------------------

export function calculateBasketInputScore(leagues: LeagueData[]): void {
  const buckets = new Map<number, LeagueData[]>();
  leagues.forEach((league) => {
    const stars = league.stars ?? 0.5;
    if (!buckets.has(stars)) {
      buckets.set(stars, []);
    }
    buckets.get(stars).push(league);
  });

  const sortedBuckets = [...buckets.entries()].toSorted((a, b) => b[0] - a[0]);
  const K = sortedBuckets.length;

  const bucketBoundaries: { max: number; min: number }[] = [];

  sortedBuckets.forEach(([stars, bucketLeagues], bucketIndex) => {
    const i = bucketIndex + 1;
    const countInBucket = bucketLeagues.length;

    let BucketMax: number, BucketMin: number, gap: number;

    if (i === 1) {
      BucketMax = 100;
      if (i < K) {
        const nextStars = sortedBuckets[i][0];
        const starDiff = stars - nextStars;
        gap = Math.max(1, starDiff * 5);
      } else {
        gap = 0;
      }
      const spacePerLeague = Math.max(0.1, 10 / countInBucket);
      const reservedSpace = Math.max(5, countInBucket * spacePerLeague);
      BucketMin = BucketMax - reservedSpace - gap;
    } else {
      const prevBucketMin = bucketBoundaries[i - 2].min;
      const prevStars = sortedBuckets[i - 2][0];
      const starDiff = prevStars - stars;

      gap = Math.max(1, starDiff * 5);

      BucketMax = prevBucketMin - gap;

      const spacePerLeague = Math.max(0.1, 10 / countInBucket);
      const reservedSpace = Math.max(5, countInBucket * spacePerLeague);

      if (i === K) {
        const minInputScoreForLastBucket = countInBucket > 50 ? 7 : countInBucket > 20 ? 5 : 4;
        BucketMin = minInputScoreForLastBucket;

        const prevBMin = i > 1 ? bucketBoundaries[i - 2].min : 100;
        const maxAllowedBucketMax = prevBMin - 0.1;

        if (BucketMax <= BucketMin) {
          const desiredBucketMax = BucketMin + Math.max(10, countInBucket * 0.5);
          BucketMax = Math.min(desiredBucketMax, maxAllowedBucketMax);

          if (BucketMax <= BucketMin) {
            BucketMin = Math.max(0.1, BucketMax - Math.max(10, countInBucket * 0.5));
          }
        }
      } else {
        const nextStars = sortedBuckets[i][0];
        const nextStarDiff = stars - nextStars;
        const nextGap = Math.max(1, nextStarDiff * 5);
        BucketMin = BucketMax - reservedSpace - nextGap;
      }
    }

    const actualBucketMin =
      i === K
        ? Math.min(BucketMin, BucketMax - 0.001)
        : Math.max(1, Math.min(BucketMin, BucketMax - 0.001));

    if (
      isNaN(BucketMax) ||
      isNaN(BucketMin) ||
      isNaN(actualBucketMin) ||
      BucketMax <= actualBucketMin
    ) {
      console.error(
        `Invalid bucket boundaries for stars ${stars}: BucketMax=${BucketMax}, BucketMin=${BucketMin}, actualBucketMin=${actualBucketMin}`
      );
      const fallbackMax = 100 - (i - 1) * 10;
      const fallbackMin = Math.max(1, fallbackMax - 10);
      BucketMax = fallbackMax;
      const safeActualBucketMin = fallbackMin;
      bucketBoundaries.push({ max: BucketMax, min: safeActualBucketMin });
    } else {
      bucketBoundaries.push({ max: BucketMax, min: actualBucketMin });
    }

    bucketLeagues.sort((a, b) => (a.rank || 0) - (b.rank || 0));

    bucketLeagues.forEach((league, posInBucket) => {
      const cnt = bucketLeagues.length;
      if (cnt === 1) {
        league.inputScore = BucketMax;
      } else {
        const safeActualBucketMin = bucketBoundaries.at(-1).min;
        const range = Math.max(0.001, BucketMax - safeActualBucketMin);
        league.inputScore = BucketMax - range * (posInBucket / (cnt - 1));
      }
    });
  });
}

export function calculateSimpleInputScore(leagues: LeagueData[]): void {
  const totalLeagues = leagues.length;
  leagues.forEach((league) => {
    // Use the explicit rank instead of array position so the function does
    // not depend on the caller keeping the array sorted by rank.
    league.inputScore = 100 * (1 - (league.rank - 1) / totalLeagues);
  });
}

/**
 * Pure LDC computation: calculates inputScore, ldcRaw, multiplier for all leagues.
 * Updates ldcCache. Does NOT touch DOM or call validateLeagueOrder/detectBasketModelProblems.
 * The DOM wrapper `calculateLDC()` in main.js calls this then those DOM functions.
 */
export function computeLDC(): void {
  const alpha = ldcSettings.model === 'basket' ? ldcSettings.alphaBasket : ldcSettings.alphaSimple;
  const leagues = ldcSettings.leagues;

  if (ldcSettings.model === 'basket') {
    calculateBasketInputScore(leagues);
  } else {
    calculateSimpleInputScore(leagues);
  }

  leagues.forEach((league) => {
    let inputScore = league.inputScore;

    if (inputScore === undefined || inputScore === null || isNaN(inputScore) || inputScore <= 0) {
      console.warn(
        `Invalid inputScore for league ${league.name}: ${inputScore}. Using default 1.0`
      );
      inputScore = 1;
    }

    // Round to 8 significant digits instead of 8 decimal places so that
    // very small values stay distinct (no silent lower clamp).
    const ldcRaw = Math.pow(inputScore / 100, alpha);
    league.ldcRaw = Number(ldcRaw.toPrecision(8));
  });

  const baseLeague = resolveMappingTargetLeague(
    { name: ldcSettings.baseLeague, nation: ldcSettings.baseLeagueNation ?? '' },
    leagues
  );
  const baseLDC = baseLeague ? baseLeague.ldcRaw : 1;

  leagues.forEach((league) => {
    league.multiplier = league.ldcRaw / baseLDC;
  });

  ldcCache.clear();
  const leagueNameCounts = new Map<string, number>();
  leagues.forEach((league) => {
    const normalized = normalizeLeagueNameForGrouping(league.name);
    leagueNameCounts.set(normalized, (leagueNameCounts.get(normalized) ?? 0) + 1);
  });
  leagues.forEach((league) => {
    ldcCache.set(createLeagueIdentityKey(league.name, league.nation), league.multiplier);
    const normalized = normalizeLeagueNameForGrouping(league.name);
    ldcCache.set(createLeagueIdentityKey(normalized, league.nation), league.multiplier);
    if (leagueNameCounts.get(normalized) === 1) {
      ldcCache.set(league.name, league.multiplier);
      ldcCache.set(normalized, league.multiplier);
    }
  });
}

// ---------------------------------------------------------------------------
// Re-exported legacy helpers kept here for backward-compatible LDC imports
// ---------------------------------------------------------------------------
export {
  filterPlayersByLDC,
  findClubLeagues,
  getLDCForLeague,
  getLDCForLeagueRaw,
  getPlayerLeagueMultiplier,
  identifyReserveTeamLeague
} from './ldcLeagueLookup';
export { loadDefaultLDCData, parseLDCCSV, parseLDCHTML } from './ldcLoading';
export {
  addLeagueMapping,
  beginMappingsTransaction,
  commitMappingsTransaction,
  ensureLdcMappingsLoadedAsync,
  loadLeagueMappings,
  normalizeLeagueMappings,
  removeLeagueMapping,
  rollbackMappingsTransaction,
  saveLeagueMappings
} from './ldcMappings';
export { applyLDCToStats, getLDCTooltip, restoreOriginalStats } from './ldcStatApplication';
