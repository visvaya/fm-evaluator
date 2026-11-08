/* eslint-disable fp/no-let, fp/no-mutation, fp/no-mutating-methods, sonarjs/cognitive-complexity, regexp/no-obscure-range -- Legacy LDC helpers extracted from main.js keep their imperative, regex-heavy style. */
/**
 * LDC utility functions – pure computation helpers extracted from main.js (Phase 4).
 * No DOM manipulation. All state accessed via ldcConfig singletons or window globals.
 */
import Fuse from 'fuse.js';

import { ldcSettings } from '../config/ldcConfig';
import { getPlayerRuntimeRows } from '../lib/playerRuntimeCache';

import {
  getMappingTarget,
  getMappingTargetName,
  getMappingTargetNation,
  loadLeagueMappings,
  resolveMappingTargetLeague
} from './ldcMappings';
import { normalizeLeagueNameForGrouping } from './ldcNameNormalization';
import { canonicalizeNation } from './ldcNations';

import type {
  BasketProblem,
  FuzzyMatchResult,
  LeagueData,
  LeagueMatchResult,
  OrderProblem
} from '../config/ldcConfig';

export { normalizeLeagueNameForGrouping } from './ldcNameNormalization';

declare global {
  interface Window {
    APP_SETTINGS: any;
    processor: any;
  }
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export function autoMapLeague(leagueName: string): null | string {
  if (!leagueName) return null;

  const normalized = normalizeLeagueNameForGrouping(leagueName);

  if (/^AF\s[A-ZÀ-ÿ\s]+/i.test(leagueName)) {
    return 'Divisões Regionais';
  }

  if (/^Polska\s+(?:III|IV|V)\s+Liga/i.test(leagueName)) {
    const match = /^(Polska\s+(?:III|IV|V)\s+Liga)/i.exec(leagueName);
    if (match) return match[1];
  }

  if (/^(?:Segunda|Tercera)\s+Federación/i.test(leagueName)) {
    const match = /^((?:Segunda|Tercera)\s+Federación)/i.exec(leagueName);
    if (match) return match[1];
  }

  return normalized === leagueName ? null : normalized;
}

export function calculateLeagueSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeLeagueNameForGrouping(name1).toLowerCase();
  const norm2 = normalizeLeagueNameForGrouping(name2).toLowerCase();

  if (norm1 === norm2) return 1;

  const level1 = extractLeagueLevel(name1);
  const level2 = extractLeagueLevel(name2);
  if (level1 !== null && level2 !== null && level1 !== level2) {
    return 0;
  }

  const words1 = norm1.split(/\s+/);
  const words2 = norm2.split(/\s+/);
  const commonWords = words1.filter((w) => words2.includes(w));
  const totalWords = Math.max(words1.length, words2.length);

  if (totalWords === 0) return 0;

  return commonWords.length / totalWords;
}

function normalizeDuplicateKeyPart(value: string): string {
  return value.toLowerCase().trim();
}

// Canonicalizes before lowercasing/trimming so aliases (ENG / England /
// Anglia) are recognized as the same country when detecting duplicates.
function normalizeDuplicateNationPart(value: string): string {
  return normalizeDuplicateKeyPart(canonicalizeNation(value));
}

/** Leagues grouped by normalized name, so a duplicate check reads one group instead of the list. */
export type LeagueNameIndex = ReadonlyMap<string, readonly LeagueNameEntry[]>;

interface LeagueNameEntry {
  index: number;
  name: string;
  nation: string;
  nationKey: string;
}

export function buildLeagueNameIndex(
  leagues: readonly LeagueData[] = ldcSettings.leagues
): LeagueNameIndex {
  const entries = leagues.map((league, index) => ({
    index,
    name: league.name,
    nation: league.nation ?? '',
    nationKey: normalizeDuplicateNationPart(league.nation ?? '')
  }));
  return Map.groupBy(entries, (entry) => normalizeDuplicateKeyPart(entry.name));
}

export function checkAmbiguousDuplicateNames(
  leagueName: string,
  leagueNation: string,
  excludeIndex = -1,
  nameIndex: LeagueNameIndex = buildLeagueNameIndex()
): string[] {
  const normalizedName = normalizeDuplicateKeyPart(leagueName);
  const normalizedNation = normalizeDuplicateNationPart(leagueNation);
  if (normalizedName.length === 0 || normalizedNation.length > 0) {
    return [];
  }

  return (nameIndex.get(normalizedName) ?? [])
    .filter(({ index }) => index !== excludeIndex)
    .map(({ name, nation, nationKey }) =>
      nationKey.length === 0 ? `${name} (brak kraju)` : `${name} (${nation})`
    );
}

export function checkDuplicateNames(
  leagueName: string,
  leagueNation = '',
  excludeIndex = -1,
  nameIndex: LeagueNameIndex = buildLeagueNameIndex()
): string[] {
  const normalizedName = normalizeDuplicateKeyPart(leagueName);
  const normalizedNation = normalizeDuplicateNationPart(leagueNation);
  if (normalizedName.length === 0 || normalizedNation.length === 0) {
    return [];
  }

  return (nameIndex.get(normalizedName) ?? [])
    .filter(({ index, nationKey }) => index !== excludeIndex && nationKey === normalizedNation)
    .map(({ name }) => name);
}

export function checkMappingConflicts(leagueName: string): string[] {
  const mappings = loadLeagueMappings();
  const conflicts: string[] = [];

  const target = getMappingTarget(mappings, leagueName);
  if (target) {
    const targetExists = resolveMappingTargetLeague(target, ldcSettings.leagues);
    if (!targetExists) {
      const targetLabel =
        target.nation.trim().length > 0 ? `${target.name} (${target.nation})` : target.name;
      conflicts.push(`Mapowanie do nieistniejącej ligi: "${targetLabel}"`);
    }
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

export function checkOrderConsistency(leagues: LeagueData[]): OrderProblem[] {
  const problems: OrderProblem[] = [];
  // Compare rank-adjacent leagues while reporting original array indices,
  // so the check does not depend on the caller keeping the array sorted.
  const indexByLeague = new Map(leagues.map((league, index) => [league, index]));
  const ordered = [...leagues].toSorted((a, b) => a.rank - b.rank);

  for (let i = 0; i < ordered.length - 1; i++) {
    const league1 = ordered[i];
    const league2 = ordered[i + 1];

    if (league1.rank < league2.rank && league1.multiplier < league2.multiplier) {
      problems.push({
        league1: league1.name,
        league1Index: indexByLeague.get(league1) ?? i,
        league1Multiplier: league1.multiplier,
        league1Rank: league1.rank,
        league2: league2.name,
        league2Index: indexByLeague.get(league2) ?? i + 1,
        league2Multiplier: league2.multiplier,
        league2Rank: league2.rank,
        suggestion: suggestOrderFix(league1, league2)
      });
    }
  }

  return problems;
}

export function extractLeagueLevel(name: string): null | number {
  const romanMatch = /\b([IVX]+)\s+liga\b/i.exec(name);
  if (romanMatch) {
    const roman = romanMatch[1].toUpperCase();
    const romanMap: Record<string, number> = {
      I: 1,
      II: 2,
      III: 3,
      IV: 4,
      IX: 9,
      V: 5,
      VI: 6,
      VII: 7,
      VIII: 8,
      X: 10
    };
    return romanMap[roman] || null;
  }

  const numMatch = /\b(\d+)\s*liga\b/i.exec(name);
  if (numMatch) {
    return parseInt(numMatch[1]);
  }

  return null;
}

export function findLeaguesWithSameLDC(): BasketProblem[] {
  const problems: BasketProblem[] = [];
  const ldcMap = new Map<string, LeagueData[]>();

  ldcSettings.leagues.forEach((league) => {
    // Group by significant digits (matching computeLDC rounding) so distinct
    // sub-1e-8 values are not collapsed into false duplicates.
    const key = league.ldcRaw.toPrecision(8);
    if (!ldcMap.has(key)) {
      ldcMap.set(key, []);
    }
    ldcMap.get(key).push(league);
  });

  ldcMap.forEach((leagues, ldcRaw) => {
    if (leagues.length > 1) {
      problems.push({
        ldcRaw: parseFloat(ldcRaw),
        leagues: leagues,
        suggestions: suggestBasketFix(leagues)
      });
    }
  });

  return problems;
}

export function formatLdcRaw(value: number, precision: number): string {
  if (value === undefined || value === null || isNaN(value)) return '0.000';
  return value.toFixed(precision);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function formatMultiplier(value: number, precision: number): string {
  if (value === undefined || value === null || isNaN(value)) return '0.000';
  return value.toFixed(precision);
}

export function fuzzyMatchLeague(
  leagueName: string,
  normalizedName: string,
  country: string,
  ldcLeagues: LeagueData[]
): FuzzyMatchResult | null {
  const countryLeagues = ldcLeagues.filter((l) => l.nation === country);
  if (countryLeagues.length === 0) return null;

  let bestMatch: LeagueData | null = null;
  let bestScore = Infinity;

  try {
    const fuse = new Fuse(countryLeagues, {
      ignoreLocation: true,
      includeScore: true,
      keys: ['name'],
      threshold: 0.3
    });

    const [topResult] = fuse.search(normalizedName);
    // includeScore is set, so score is present; a missing score never matches.
    const topScore = topResult?.score ?? Infinity;
    if (topResult && topScore < 0.3) {
      bestMatch = topResult.item;
      bestScore = topScore;
    }
  } catch (error) {
    console.warn('[LDC] Fuse.js error, using Levenshtein fallback:', error);
  }

  if (!bestMatch) {
    for (const league of countryLeagues) {
      const left = normalizedName.toLowerCase();
      const right = league.name.toLowerCase();
      const maxLen = Math.max(normalizedName.length, league.name.length);
      // The distance is at least the length difference, so such a pair cannot pass 0.7 similarity.
      if (Math.abs(left.length - right.length) >= 0.3 * maxLen) continue;
      const distance = levenshteinDistance(left, right);
      const similarity = 1 - distance / maxLen;

      if (similarity > 0.7 && similarity > 1 - bestScore) {
        bestMatch = league;
        bestScore = 1 - similarity;
      }
    }
  }

  return bestMatch ? { league: bestMatch, score: bestScore } : null;
}

export function getLeaguesHash(leagues: LeagueData[]): string {
  if (leagues.length === 0) return '0';

  return stableHash(
    leagues.map((league) =>
      [
        league.id ?? '',
        league.name,
        league.nation,
        league.rank,
        league.stars ?? '',
        league.inputScore,
        league.ldcRaw,
        league.multiplier
      ].join('\u001F')
    )
  );
}

function stableHash(parts: readonly string[]) {
  let hash = 2_166_136_261;
  const input = parts.join('\u001E');

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.codePointAt(index) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }

  return `${parts.length}:${(hash >>> 0).toString(36)}`;
}

export function getOptimalLdcRawPrecision(leagues: { ldcRaw: number }[]): number {
  if (!leagues || leagues.length === 0) return 3;

  const ldcRawValues = leagues
    .map((l) => l.ldcRaw)
    .filter((v) => v !== undefined && v !== null && !isNaN(v) && v > 0)
    .toSorted((a, b) => a - b);

  if (ldcRawValues.length < 2) return 3;

  let minDiff = Infinity;
  for (let i = 1; i < ldcRawValues.length; i++) {
    const diff = Math.abs(ldcRawValues[i] - ldcRawValues[i - 1]);
    if (diff > 0 && diff < minDiff) {
      minDiff = diff;
    }
  }

  if (minDiff === Infinity || minDiff === 0) {
    const maxValue = Math.max(...ldcRawValues);
    if (maxValue < 0.001) return 8;
    return 3;
  }

  if (minDiff >= 0.1) return 1;
  if (minDiff >= 0.01) return 2;
  if (minDiff >= 0.001) return 3;
  if (minDiff >= 0.0001) return 4;
  if (minDiff >= 0.00001) return 5;
  if (minDiff >= 0.000001) return 6;
  if (minDiff >= 0.0000001) return 7;
  return 8;
}

export function getOptimalMultiplierPrecision(leagues: { multiplier: number }[]): number {
  if (!leagues || leagues.length === 0) return 3;

  const multiplierValues = leagues
    .map((l) => l.multiplier)
    .filter((v) => v !== undefined && v !== null && !isNaN(v) && v > 0)
    .toSorted((a, b) => a - b);

  if (multiplierValues.length === 0) return 3;

  const minValue = Math.min(...multiplierValues);
  const maxValue = Math.max(...multiplierValues);

  let minPrecisionNeeded = 3;
  if (minValue < 0.0000001) minPrecisionNeeded = 8;
  else if (minValue < 0.000001) minPrecisionNeeded = 7;
  else if (minValue < 0.00001) minPrecisionNeeded = 6;
  else if (minValue < 0.0001) minPrecisionNeeded = 5;
  else if (minValue < 0.001) minPrecisionNeeded = 4;

  if (maxValue < 0.001) {
    return minPrecisionNeeded;
  }

  if (multiplierValues.length < 2) {
    return minPrecisionNeeded;
  }

  let minDiff = Infinity;
  for (let i = 1; i < multiplierValues.length; i++) {
    const diff = Math.abs(multiplierValues[i] - multiplierValues[i - 1]);
    if (diff > 0 && diff < minDiff) {
      minDiff = diff;
    }
  }

  if (minDiff === Infinity || minDiff === 0) {
    return minPrecisionNeeded;
  }

  let diffPrecision: number;
  if (minDiff >= 0.1) diffPrecision = 1;
  else if (minDiff >= 0.01) diffPrecision = 2;
  else if (minDiff >= 0.001) diffPrecision = 3;
  else if (minDiff >= 0.0001) diffPrecision = 4;
  else if (minDiff >= 0.00001) diffPrecision = 5;
  else if (minDiff >= 0.000001) diffPrecision = 6;
  else if (minDiff >= 0.0000001) diffPrecision = 7;
  else diffPrecision = 8;

  return Math.max(minPrecisionNeeded, diffPrecision);
}

export function getPlayerDataHash(): string {
  const playerRows = getPlayerRuntimeRows();
  if (playerRows.length === 0) return 'no_data';
  const identities = new Map<string, number>();

  playerRows.forEach((player) => {
    // Based In (league country) drives matching; Nation (player nationality)
    // must not be a fallback or the cache key would diverge from scoring.
    const identity = `${String(player.Division ?? '').trim()}\u001F${String(
      player['Based In'] ?? ''
    ).trim()}`;
    identities.set(identity, (identities.get(identity) ?? 0) + 1);
  });

  return stableHash(
    [...identities.entries()]
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([identity, count]) => `${identity}\u001F${count}`)
  );
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function improvedLeagueMatching(source: string, target: string): LeagueMatchResult {
  const normSource = normalizeLeagueNameForGrouping(source);
  const normTarget = normalizeLeagueNameForGrouping(target);

  if (normSource.toLowerCase() === normTarget.toLowerCase()) {
    return { confidence: 1, match: true, type: 'normalized' };
  }

  const normSourceRoman = normalizeRomanNumerals(normSource);
  const normTargetRoman = normalizeRomanNumerals(normTarget);

  if (normSourceRoman.toLowerCase() === normTargetRoman.toLowerCase()) {
    return { confidence: 0.95, match: true, type: 'normalized_roman' };
  }

  const similarity = calculateLeagueSimilarity(source, target);
  if (similarity >= 0.8) {
    return { confidence: similarity, match: true, type: 'similarity' };
  }

  return { confidence: similarity, match: false, type: 'none' };
}

export function isFreeAgent(division: string): boolean {
  if (!division) return true;
  const trimmed = division.trim();
  if (trimmed === '-' || trimmed.startsWith('-')) return true;
  if (trimmed.length < 3) return true;
  return false;
}

export function isLeagueMatched(leagueName: string, leagueNation = ''): boolean {
  const playerRows = getPlayerRuntimeRows();
  if (playerRows.length === 0) return false;

  const mappings = loadLeagueMappings();
  const normalizedName = normalizeLeagueNameForGrouping(leagueName);

  for (const player of playerRows) {
    const division = player.Division;
    if (isFreeAgent(division)) continue;

    const playerLeague = division.trim();
    const playerNormalized = normalizeLeagueNameForGrouping(playerLeague);
    // Based In (league country) drives matching; Nation (player nationality)
    // must not be a fallback here (scoring never reads it either).
    const playerNation = canonicalizeNation(String(player['Based In'] || ''));

    if (
      (playerLeague === leagueName || playerNormalized === normalizedName) &&
      (!leagueNation || !playerNation || playerNation === leagueNation)
    ) {
      return true;
    }

    const mappedTarget = getMappingTarget(mappings, playerLeague, playerNation);
    const mappedLeague = getMappingTargetName(mappedTarget);
    const mappedNation = getMappingTargetNation(mappedTarget);
    if (
      (mappedLeague === leagueName ||
        normalizeLeagueNameForGrouping(mappedLeague) === normalizedName) &&
      (!leagueNation || !mappedNation || mappedNation === leagueNation)
    ) {
      return true;
    }
  }

  return false;
}

export function levenshteinDistance(str1: string, str2: string): number {
  // Two rows instead of the full matrix: same result, memory linear in the shorter string.
  const [longer, shorter] = str1.length >= str2.length ? [str1, str2] : [str2, str1];
  const longerUnits = toCodeUnits(longer);
  const shorterUnits = toCodeUnits(shorter);
  let previous = Uint32Array.from({ length: shorter.length + 1 }, (_, j) => j);
  let current = new Uint32Array(shorter.length + 1);

  for (let i = 1; i <= longer.length; i++) {
    const unit = longerUnits[i - 1];
    current[0] = i;
    for (let j = 1; j <= shorter.length; j++) {
      const diagonal = previous[j - 1] ?? 0;
      current[j] =
        unit === shorterUnits[j - 1]
          ? diagonal
          : Math.min(previous[j] ?? 0, current[j - 1] ?? 0, diagonal) + 1;
    }
    [previous, current] = [current, previous];
  }

  return previous[shorter.length] ?? 0;
}

/** UTF-16 code units: the distance counts them, as indexing the string does. */
function toCodeUnits(text: string): Uint16Array {
  // eslint-disable-next-line unicorn/prefer-code-point -- code units on purpose, see above
  return Uint16Array.from({ length: text.length }, (_, index) => text.charCodeAt(index));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function normalizeRomanNumerals(text: string): string {
  const romanMap: Record<string, number> = {
    I: 1,
    II: 2,
    III: 3,
    IV: 4,
    IX: 9,
    V: 5,
    VI: 6,
    VII: 7,
    VIII: 8,
    X: 10
  };

  return text.replaceAll(/\b(?:I{1,3}|IV|IX|VI{0,3}|X)\b/gi, (roman) =>
    String(romanMap[roman.toUpperCase()])
  );
}

export function suggestBasketFix(leagues: LeagueData[]): string[] {
  if (ldcSettings.model === 'simple') {
    return [
      'Ligi mają identyczny LDC_raw w modelu prostym - rozróżnij je, zmieniając kolejność (rank) lub wartość alpha'
    ];
  }

  const suggestions: string[] = [];

  const stars = [...new Set(leagues.map((l) => l.stars))];
  if (stars.length > 1) {
    suggestions.push('Ligi mają różne gwiazdki - rozważ zmianę gwiazdek, aby rozróżnić ligi');
  }

  const ranks = leagues.map((l) => l.rank).toSorted((a, b) => a - b);
  if (ranks.at(-1) - ranks[0] > leagues.length) {
    suggestions.push('Ligi mają różne rangi - rozważ zmianę ranku, aby rozróżnić ligi');
  }

  if (suggestions.length === 0) {
    suggestions.push(
      'Rozważ zmianę gwiazdek lub ranku, aby rozróżnić ligi w koszyku',
      'Lub przełącz się na model prosty (Rank Based)'
    );
  }

  return suggestions;
}

export function suggestOrderFix(league1: LeagueData, league2: LeagueData): string {
  const suggestions: string[] = [];

  if (league1.stars !== null && league2.stars !== null && league1.stars === league2.stars) {
    suggestions.push(`Zmień gwiazdki ligi "${league1.name}" lub "${league2.name}"`);
  }

  suggestions.push(`Zamień miejscami ligi "${league1.name}" i "${league2.name}"`);

  return `${suggestions.join('. ')}.`;
}

/** Pass one `buildLeagueNameIndex()` when validating many leagues; the default builds it per call. */
export function validateLeague(
  league: LeagueData,
  excludeIndex = -1,
  nameIndex: LeagueNameIndex = buildLeagueNameIndex()
): string[] {
  const errors: string[] = [];

  const duplicates = checkDuplicateNames(league.name, league.nation ?? '', excludeIndex, nameIndex);
  if (duplicates.length > 0) {
    errors.push(`Duplikat nazwy: "${duplicates[0]}"`);
  }

  const ambiguousDuplicates = checkAmbiguousDuplicateNames(
    league.name,
    league.nation ?? '',
    excludeIndex,
    nameIndex
  );
  if (ambiguousDuplicates.length > 0) {
    errors.push('Powielona nazwa ligi bez przypisanego kraju');
  }

  if (
    league.stars !== null &&
    (!Number.isFinite(league.stars) || league.stars < 0.5 || league.stars > 5)
  ) {
    errors.push('Gwiazdki poza zakresem (0.5-5)');
  }
  if (!Number.isFinite(league.rank) || league.rank <= 0) {
    errors.push('Rank musi być większy od 0');
  }

  const mappingConflicts = checkMappingConflicts(league.name);
  if (mappingConflicts.length > 0) {
    errors.push(`Konflikt w mapowaniach: ${mappingConflicts.join(', ')}`);
  }

  return errors;
}
