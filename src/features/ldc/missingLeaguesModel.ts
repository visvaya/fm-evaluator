/* eslint-disable fp/no-let, fp/no-mutation, fp/no-mutating-methods, sonarjs/cognitive-complexity, sonarjs/max-lines-per-function, sonarjs/no-nested-conditional, unicorn/no-array-sort */

import { createLeagueIdentityKey, parseLeagueIdentityKey } from '@/computing/ldcMappings';
import { COUNTRY_CODE_MAP } from '@/config/constants';

export interface LdcLeagueMatch {
  name: string;
  nation?: string;
  rank: number;
  stars: null | number;
}

export interface MissingLeagueCandidate {
  countryCode: string;
  matchScore: null | number;
  matchType: string;
  name: string;
  nation: string;
  normalized: string;
  suggestedMatch: LdcLeagueMatch | null;
  suggestedRank: number;
  suggestedStars: null | number;
}

export interface MissingLeagueSubGroup {
  country: string;
  displayName: string;
  key: string;
  leagues: MissingLeagueCandidate[];
  normalizedName: null | string;
}

export interface MissingLeagueCountryGroup {
  country: string;
  displayName: string;
  key: string;
  leagues: MissingLeagueCandidate[];
  subGroups: MissingLeagueSubGroup[];
}

export interface MissingLeagueRecheckSummary {
  message: string;
  tone: 'neutral' | 'positive' | 'warning';
}

export interface DetectMissingLeagueDependencies {
  autoMapLeague: (originalName: string) => null | string;
  fuzzyMatchLeague: (
    originalName: string,
    normalizedName: string,
    country: string,
    leagues: LdcLeagueMatch[]
  ) => null | { league: LdcLeagueMatch; score: number };
  improvedLeagueMatching: (
    originalName: string,
    candidateName: string
  ) => { confidence: number; match: boolean; type: string };
  isFreeAgent: (division: string) => boolean;
  mapCountryCode: (countryCode: string) => string;
  normalizeLeagueNameForGrouping: (value: string) => string;
}

export interface DetectMissingLeaguePlayer {
  'Based In'?: string;
  Division?: string;
  Nation?: string;
}

export type LeagueMappingRecord = Record<string, string | { name: string; nation: string }>;

/**
 * Mirrors the runtime lookup in getMappingTarget: nation-scoped sources only
 * match nation-scoped mapping keys, nation-less sources only nation-less keys.
 * A mapping that the runtime would ignore must not hide a league here.
 */
function findSourceMappingTarget(
  mappings: LeagueMappingRecord,
  sourceName: string,
  sourceNation: string,
  normalizeName: (value: string) => string,
  canonicalizeNation: (value: string) => string
): string | undefined | { name: string; nation: string } {
  const normalizedName = normalizeName(sourceName);
  const hasNation = sourceNation.trim().length > 0;
  const directKeys = hasNation
    ? [
        createLeagueIdentityKey(sourceName, sourceNation),
        createLeagueIdentityKey(normalizedName, sourceNation)
      ]
    : [sourceName, normalizedName];

  for (const key of directKeys) {
    if (mappings[key] !== undefined) {
      return mappings[key];
    }
  }

  // sourceNation is already canonical (it comes from the injected
  // canonicalizer); only the mapping-key side may still hold raw FM codes.
  const normalizedNation = sourceNation.trim().toLocaleLowerCase();
  const matches = Object.entries(mappings).filter(([key]) => {
    const source = parseLeagueIdentityKey(key);
    if (normalizeName(source.name) !== normalizedName) {
      return false;
    }

    return normalizedNation.length === 0
      ? source.nation.trim().length === 0
      : canonicalizeNation(source.nation).trim().toLocaleLowerCase() === normalizedNation;
  });

  return matches.length === 1 ? matches[0][1] : undefined;
}

/**
 * A mapping only counts as resolved when its target still points at an
 * existing league; otherwise the runtime falls back to the neutral 1.000
 * multiplier and the league must stay visible in the missing list.
 */
function mappingTargetResolves(
  target: string | { name: string; nation: string },
  ldcLeagues: readonly LdcLeagueMatch[],
  normalizeName: (value: string) => string,
  canonicalizeNation: (value: string) => string
): boolean {
  const targetName = typeof target === 'string' ? target : target.name;
  const targetNation = typeof target === 'string' ? '' : (target.nation ?? '').trim();
  const normalizedTargetName = normalizeName(targetName);
  const nameMatches = ldcLeagues.filter(
    (league) => normalizeName(league.name) === normalizedTargetName
  );

  if (targetNation.length === 0) {
    const exactMatches = ldcLeagues.filter((league) => league.name === targetName);
    return exactMatches.length === 1 || nameMatches.length === 1;
  }

  const normalizedTargetNation = canonicalizeNation(targetNation).trim().toLocaleLowerCase();
  const nationMatches = nameMatches.filter(
    (league) =>
      canonicalizeNation(league.nation ?? '')
        .trim()
        .toLocaleLowerCase() === normalizedTargetNation
  );
  return nationMatches.length === 1;
}

function sortDisplayNames(a: string, b: string) {
  const aIsOther = a === 'Inne';
  const bIsOther = b === 'Inne';

  if (aIsOther && !bIsOther) {
    return 1;
  }

  if (!aIsOther && bIsOther) {
    return -1;
  }

  return a.localeCompare(b);
}

export function buildMissingLeagueCandidates(
  players: readonly DetectMissingLeaguePlayer[],
  ldcLeagues: LdcLeagueMatch[],
  leagueMappings: LeagueMappingRecord,
  deps: DetectMissingLeagueDependencies,
  preferStarsSuggestion: boolean
): MissingLeagueCandidate[] {
  if (players.length === 0) {
    return [];
  }

  const playerLeagues = new Map<
    string,
    { country: string; countryCode: string; normalized: string; original: string }
  >();

  players.forEach((player) => {
    const division = player.Division;
    if (typeof division !== 'string' || deps.isFreeAgent(division)) {
      return;
    }

    const originalName = division.trim();
    if (!originalName) {
      return;
    }

    const normalizedName = deps.normalizeLeagueNameForGrouping(originalName);
    // Based In is the league's country; Nation is the player's nationality.
    // Scoring (getLDCForLeague) only ever reads Based In, so diagnostics must
    // not fall back to Nation or a foreign player would be diagnosed against
    // their home country instead of the country they actually play in.
    const countryCode = String(player['Based In'] || '');
    const country = deps.mapCountryCode(countryCode);
    const mappingTarget = findSourceMappingTarget(
      leagueMappings,
      originalName,
      country,
      deps.normalizeLeagueNameForGrouping,
      deps.mapCountryCode
    );
    if (
      mappingTarget !== undefined &&
      mappingTargetResolves(
        mappingTarget,
        ldcLeagues,
        deps.normalizeLeagueNameForGrouping,
        deps.mapCountryCode
      )
    ) {
      return;
    }

    const playerLeagueKey = createLeagueIdentityKey(originalName, country);
    if (!playerLeagues.has(playerLeagueKey)) {
      playerLeagues.set(playerLeagueKey, {
        country,
        countryCode,
        normalized: normalizedName,
        original: originalName
      });
    }
  });

  const normalizedNameCounts = new Map<string, number>();
  ldcLeagues.forEach((league) => {
    const normalized = deps.normalizeLeagueNameForGrouping(league.name);
    normalizedNameCounts.set(normalized, (normalizedNameCounts.get(normalized) ?? 0) + 1);
  });

  const missing: MissingLeagueCandidate[] = [];

  for (const leagueInfo of playerLeagues.values()) {
    const { original: originalName } = leagueInfo;
    // Contract: league identity is name+nation. When the source country is
    // known, suggestions may only come from leagues of that country.
    // Without a source country, only globally-unique names are unambiguous;
    // same-named leagues in several countries need an explicit user decision.
    const candidateLeagues =
      leagueInfo.country.length > 0
        ? ldcLeagues.filter((league) => league.nation === leagueInfo.country)
        : ldcLeagues.filter(
            (league) =>
              normalizedNameCounts.get(deps.normalizeLeagueNameForGrouping(league.name)) === 1
          );
    const candidateNames = new Set(candidateLeagues.map((league) => league.name));
    const candidateNormalizedNames = new Map<string, LdcLeagueMatch>();
    candidateLeagues.forEach((league) => {
      const normalized = deps.normalizeLeagueNameForGrouping(league.name);
      if (!candidateNormalizedNames.has(normalized)) {
        candidateNormalizedNames.set(normalized, league);
      }
    });
    const directMatches = ldcLeagues.filter(
      (league) => deps.normalizeLeagueNameForGrouping(league.name) === leagueInfo.normalized
    );
    const hasCountryMatch = directMatches.some(
      (league) => leagueInfo.country.length > 0 && league.nation === leagueInfo.country
    );
    const hasUniqueUnscopedMatch = leagueInfo.country.length === 0 && directMatches.length === 1;
    if (hasCountryMatch || hasUniqueUnscopedMatch) {
      continue;
    }

    let bestMatch: LdcLeagueMatch | null = null;
    let bestMatchType = 'none';
    let bestMatchScore = 0;

    if (leagueInfo.normalized === 'Divisões Regionais') {
      const divisoesExact = candidateLeagues.find((league) => league.name === 'Divisões Regionais');
      if (divisoesExact) {
        bestMatch = divisoesExact;
        bestMatchType = 'normalized';
        bestMatchScore = 1;
      } else if (candidateNormalizedNames.has('Divisões Regionais')) {
        bestMatch = candidateNormalizedNames.get('Divisões Regionais') ?? null;
        bestMatchType = 'normalized';
        bestMatchScore = 1;
      }
    }

    if (!bestMatch && candidateNormalizedNames.has(leagueInfo.normalized)) {
      bestMatch = candidateNormalizedNames.get(leagueInfo.normalized) ?? null;
      bestMatchType = 'normalized';
      bestMatchScore = 1;
    }

    if (!bestMatch) {
      const autoMappedName = deps.autoMapLeague(originalName);
      if (autoMappedName) {
        if (autoMappedName === 'Divisões Regionais') {
          const divisoesExact = candidateLeagues.find(
            (league) => league.name === 'Divisões Regionais'
          );
          if (divisoesExact) {
            bestMatch = divisoesExact;
            bestMatchType = 'auto-mapped';
            bestMatchScore = 0.95;
          } else if (candidateNormalizedNames.has('Divisões Regionais')) {
            bestMatch = candidateNormalizedNames.get('Divisões Regionais') ?? null;
            bestMatchType = 'auto-mapped';
            bestMatchScore = 0.95;
          }
        } else if (candidateNames.has(autoMappedName)) {
          bestMatch = candidateLeagues.find((league) => league.name === autoMappedName) ?? null;
          bestMatchType = 'auto-mapped';
          bestMatchScore = 0.9;
        } else {
          const autoMappedNormalized = deps.normalizeLeagueNameForGrouping(autoMappedName);
          if (candidateNormalizedNames.has(autoMappedNormalized)) {
            bestMatch = candidateNormalizedNames.get(autoMappedNormalized) ?? null;
            bestMatchType = 'auto-mapped';
            bestMatchScore = 0.9;
          }
        }
      }
    }

    if (!bestMatch) {
      for (const ldcLeague of candidateLeagues) {
        if (
          leagueInfo.normalized === 'Divisões Regionais' &&
          ldcLeague.name.includes('AF Porto') &&
          ldcLeague.name !== 'Divisões Regionais'
        ) {
          continue;
        }

        const matchResult = deps.improvedLeagueMatching(originalName, ldcLeague.name);
        if (matchResult.match && matchResult.confidence > bestMatchScore) {
          bestMatch = ldcLeague;
          bestMatchType = matchResult.type;
          bestMatchScore = matchResult.confidence;
        }
      }
    }

    if (!bestMatch) {
      const leaguesForFuzzy =
        leagueInfo.normalized === 'Divisões Regionais'
          ? candidateLeagues.filter(
              (league) =>
                !(league.name.includes('AF Porto') && league.name !== 'Divisões Regionais')
            )
          : candidateLeagues;
      const fuzzyMatch = deps.fuzzyMatchLeague(
        originalName,
        leagueInfo.normalized,
        leagueInfo.country,
        leaguesForFuzzy
      );
      // fuzzyMatchLeague returns a distance (lower is better, accepted < 0.3);
      // expose it as a similarity-style confidence for display.
      if (fuzzyMatch && fuzzyMatch.score < 0.3) {
        bestMatch = fuzzyMatch.league;
        bestMatchType = 'fuzzy';
        bestMatchScore = 1 - fuzzyMatch.score;
      }
    }

    const similarLeagues = ldcLeagues.filter((league) => league.nation === leagueInfo.country);
    let suggestedStars: null | number = null;
    let suggestedRank = ldcLeagues.length + 1;

    if (bestMatch) {
      suggestedStars = bestMatch.stars;
      suggestedRank = bestMatch.rank;
    } else if (similarLeagues.length > 0 && preferStarsSuggestion) {
      const avgStars =
        similarLeagues.reduce((sum, league) => sum + (league.stars || 0), 0) /
        similarLeagues.length;
      suggestedStars = Math.round(avgStars * 2) / 2;
    } else if (similarLeagues.length > 0) {
      const avgRank =
        similarLeagues.reduce((sum, league) => sum + league.rank, 0) / similarLeagues.length;
      suggestedRank = Math.round(avgRank);
    }

    missing.push({
      countryCode: leagueInfo.countryCode,
      matchScore: bestMatchScore < 1 ? bestMatchScore : null,
      matchType: bestMatchType,
      name: originalName,
      nation: leagueInfo.country,
      normalized: leagueInfo.normalized,
      suggestedMatch: bestMatch,
      suggestedRank,
      suggestedStars
    });
  }

  return missing;
}

export function groupMissingLeagueCandidates(
  missingLeagues: MissingLeagueCandidate[],
  normalizeLeagueNameForGrouping: (value: string) => string
): MissingLeagueCountryGroup[] {
  const countryGroups = new Map<string, MissingLeagueCandidate[]>();
  const otherCountryLeagues: MissingLeagueCandidate[] = [];

  missingLeagues.forEach((league) => {
    const isKnownCountry = Boolean(league.countryCode && COUNTRY_CODE_MAP[league.countryCode]);
    if (isKnownCountry) {
      const country = league.nation || 'Nieznany kraj';
      const countryLeagues = countryGroups.get(country) ?? [];
      countryLeagues.push(league);
      countryGroups.set(country, countryLeagues);
      return;
    }

    otherCountryLeagues.push(league);
  });

  const result: MissingLeagueCountryGroup[] = [];

  countryGroups.forEach((countryLeagues, country) => {
    const normalizedGroups = new Map<string, MissingLeagueCandidate[]>();
    const otherLeagues: MissingLeagueCandidate[] = [];

    countryLeagues.forEach((league) => {
      const normalized = normalizeLeagueNameForGrouping(league.name);
      const leagueList = normalizedGroups.get(normalized) ?? [];
      leagueList.push(league);
      normalizedGroups.set(normalized, leagueList);
    });

    const countryGroupItems: MissingLeagueSubGroup[] = [];
    normalizedGroups.forEach((leagueList, normalized) => {
      if (leagueList.length > 1) {
        countryGroupItems.push({
          country,
          displayName: normalized || leagueList[0].name,
          key: `${normalized}|${country}`,
          leagues: leagueList,
          normalizedName: normalized
        });
        return;
      }

      otherLeagues.push(...leagueList);
    });

    if (otherLeagues.length > 0) {
      countryGroupItems.push({
        country,
        displayName: 'Inne',
        key: `other|${country}`,
        leagues: otherLeagues,
        normalizedName: null
      });
    }

    countryGroupItems.sort((a, b) => {
      const nameComparison = sortDisplayNames(a.displayName, b.displayName);
      if (nameComparison !== 0) {
        return nameComparison;
      }

      return (a.leagues[0]?.name || '').localeCompare(b.leagues[0]?.name || '');
    });

    result.push({
      country,
      displayName: country,
      key: `country-${country}`,
      leagues: countryLeagues,
      subGroups: countryGroupItems
    });
  });

  if (otherCountryLeagues.length > 0) {
    const normalizedGroups = new Map<string, MissingLeagueCandidate[]>();
    const otherLeagues: MissingLeagueCandidate[] = [];

    otherCountryLeagues.forEach((league) => {
      const normalized = normalizeLeagueNameForGrouping(league.name);
      const leagueList = normalizedGroups.get(normalized) ?? [];
      leagueList.push(league);
      normalizedGroups.set(normalized, leagueList);
    });

    const countryGroupItems: MissingLeagueSubGroup[] = [];
    normalizedGroups.forEach((leagueList, normalized) => {
      if (leagueList.length > 1) {
        countryGroupItems.push({
          country: 'Inne',
          displayName: normalized || leagueList[0].name,
          key: `${normalized}|Inne`,
          leagues: leagueList,
          normalizedName: normalized
        });
        return;
      }

      otherLeagues.push(...leagueList);
    });

    if (otherLeagues.length > 0) {
      countryGroupItems.push({
        country: 'Inne',
        displayName: 'Inne',
        key: 'other|Inne',
        leagues: otherLeagues,
        normalizedName: null
      });
    }

    countryGroupItems.sort((a, b) => {
      const nameComparison = sortDisplayNames(a.displayName, b.displayName);
      if (nameComparison !== 0) {
        return nameComparison;
      }

      return (a.leagues[0]?.name || '').localeCompare(b.leagues[0]?.name || '');
    });

    result.push({
      country: 'Inne',
      displayName: 'Inne',
      key: 'country-Inne',
      leagues: otherCountryLeagues,
      subGroups: countryGroupItems
    });
  }

  return result.sort((a, b) => sortDisplayNames(a.country, b.country));
}

export function buildMissingLeagueRecheckSummary(
  previousMissing: MissingLeagueCandidate[],
  nextMissing: MissingLeagueCandidate[]
): MissingLeagueRecheckSummary {
  const previousNames = new Set(previousMissing.map((league) => league.name));
  const nextNames = new Set(nextMissing.map((league) => league.name));
  const added = [...nextNames].filter((name) => !previousNames.has(name));
  const removed = [...previousNames].filter((name) => !nextNames.has(name));

  if (previousMissing.length === nextMissing.length && added.length === 0 && removed.length === 0) {
    return {
      message: `Brak zmian - nadal ${nextMissing.length} brakujących lig`,
      tone: 'neutral'
    };
  }

  if (nextMissing.length === 0) {
    return {
      message: `Wszystkie ligi zostały dodane! (było: ${previousMissing.length}, teraz: 0)`,
      tone: 'positive'
    };
  }

  if (nextMissing.length < previousMissing.length) {
    const removedText =
      removed.length > 0
        ? ` (usunięto: ${removed.slice(0, 3).join(', ')}${removed.length > 3 ? '...' : ''})`
        : '';
    return {
      message: `Zmniejszono liczbę brakujących lig z ${previousMissing.length} do ${nextMissing.length}${removedText}`,
      tone: 'positive'
    };
  }

  if (nextMissing.length > previousMissing.length) {
    const addedText =
      added.length > 0
        ? ` (dodano: ${added.slice(0, 3).join(', ')}${added.length > 3 ? '...' : ''})`
        : '';
    return {
      message: `Zwiększono liczbę brakujących lig z ${previousMissing.length} do ${nextMissing.length}${addedText}`,
      tone: 'warning'
    };
  }

  const changedText =
    added.length > 0 || removed.length > 0
      ? ` - dodano: ${added.length}, usunięto: ${removed.length}`
      : '';
  return {
    message: `Zmieniono listę brakujących lig (Lig: ${nextMissing.length})${changedText}`,
    tone: 'neutral'
  };
}
