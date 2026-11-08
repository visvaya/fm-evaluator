// Phase 5F: OCR club matching (Fuse.js + Levenshtein) – migrated from main.js
import Fuse from 'fuse.js';

import { levenshteinDistance } from '../computing/ldcUtils';
import { normalizeDiacritics } from '../utils/helpers';

export interface ClubData {
  club: string;
  country: string;
  league: string;
  players: any[];
}

export interface ClubMatchResult {
  club: string;
  country: null | string;
  league: string;
  leagueMatch: boolean;
  nameSimilarity: number;
  score: number;
}

export function correctCommonOCRErrors(text: string): string {
  if (!text) return '';
  const ocrCorrections = [
    { pattern: /\bIll\b/gi, replacement: 'III' },
    { pattern: /\bIl\b/gi, replacement: 'II' },
    {
      pattern: /ll\b(?=\s*(?:Liga|liga|grupa|group|serie|série|division|IV|V|VI|VII|VIII|IX|X))/gi,
      replacement: 'II'
    },
    { pattern: /([A-ZÀ-ÿ]{3,})ll\b/gi, replacement: '$1 II' },
    { pattern: /([A-ZÀ-ÿ]{3,})li\b/gi, replacement: '$1 II' },
    { pattern: /ll\b/gi, replacement: 'II' },
    { pattern: /\bl\b(?=\s*(?:Liga|liga|grupa|group|serie|série|division))/gi, replacement: 'I' },
    { pattern: /\bdo\s+(\d+)/gi, replacement: 'ão $1' },
    { pattern: /\bao\s+(\d+)/gi, replacement: 'ão $1' },
    { pattern: /\bdo\b/gi, replacement: 'ão' },
    { pattern: /\bao\b/gi, replacement: 'ão' },
    { pattern: /0(?=[A-Z])/gi, replacement: 'O' },
    { pattern: /(?<=[A-Z])0(?=[A-Z])/gi, replacement: 'o' },
    { pattern: /1(?=[A-Z])/gi, replacement: 'I' },
    { pattern: /(?<=[A-Z])1(?=[A-Z])/gi, replacement: 'i' },
    { pattern: /5(?=[A-Z])/gi, replacement: 'S' },
    { pattern: /(?<=[A-Z])5(?=[A-Z])/gi, replacement: 's' },
    { pattern: /\bao\b/gi, replacement: 'ą' },
    { pattern: /\bce\b/gi, replacement: 'ć' },
    { pattern: /\beo\b/gi, replacement: 'ę' },
    { pattern: /\blo\b/gi, replacement: 'ł' },
    { pattern: /\bno\b/gi, replacement: 'ń' },
    { pattern: /\bso\b/gi, replacement: 'ś' },
    { pattern: /\bzo\b/gi, replacement: 'ż' },
    { pattern: /\bzz\b/gi, replacement: 'ź' },
    { pattern: /\ba~o\b/gi, replacement: 'ão' },
    { pattern: /\bao\b/gi, replacement: 'ão' },
    { pattern: /\ba'\b/gi, replacement: 'á' },
    { pattern: /\be'\b/gi, replacement: 'é' },
    { pattern: /\bi'\b/gi, replacement: 'í' },
    { pattern: /\bo'\b/gi, replacement: 'ó' },
    { pattern: /\bu'\b/gi, replacement: 'ú' },
    { pattern: /\ba`\b/gi, replacement: 'à' },
    { pattern: /\be`\b/gi, replacement: 'è' },
    { pattern: /\bi`\b/gi, replacement: 'ì' },
    { pattern: /\bo`\b/gi, replacement: 'ò' },
    { pattern: /\bu`\b/gi, replacement: 'ù' },
    { pattern: /%20/g, replacement: ' ' },
    { pattern: /&amp;/gi, replacement: '&' },
    { pattern: /&lt;/gi, replacement: '<' },
    { pattern: /&gt;/gi, replacement: '>' }
  ];
  let corrected = text;
  for (const { pattern, replacement } of ocrCorrections) {
    corrected = corrected.replace(pattern, replacement);
  }
  return corrected;
}

export function findBestClubMatchWithLeague(
  ocrName: string,
  ocrLeague: string,
  clubMap: Map<string, ClubData>,
  filterByLeague = false
): ClubMatchResult | null {
  if (!ocrName || clubMap.size === 0) return null;

  // STEP 0: diacritics correction
  const normalizedOcr = normalizeTextForMatching(ocrName);
  let bestDiacriticMatch: ClubMatchResult | null = null;
  let bestDiacriticScore = 0;
  const minDiacriticScore = 0.85;
  for (const [, data] of clubMap.entries()) {
    if (normalizedOcr === normalizeTextForMatching(data.club)) {
      const distance = levenshteinDistance(ocrName.toLowerCase(), data.club.toLowerCase());
      const maxLen = Math.max(ocrName.length, data.club.length);
      const similarity = maxLen > 0 ? 1 - distance / maxLen : 0;
      if (similarity > bestDiacriticScore && similarity >= minDiacriticScore) {
        bestDiacriticScore = similarity;
        bestDiacriticMatch = {
          club: data.club,
          country: data.country || null,
          league: data.league,
          leagueMatch: filterByLeague
            ? true
            : ocrLeague && data.league
              ? leaguesMatch(ocrLeague, data.league)
              : false,
          nameSimilarity: similarity,
          score: similarity
        };
      }
    }
  }
  if (bestDiacriticMatch) return bestDiacriticMatch;

  // STEP 1: exact match
  const exactMatch = findExactClubMatch(ocrName, clubMap);
  if (exactMatch) {
    exactMatch.leagueMatch = filterByLeague
      ? true
      : ocrLeague && exactMatch.league
        ? leaguesMatch(ocrLeague, exactMatch.league)
        : false;
    return exactMatch;
  }

  const cleanOcrName = normalizeTextForMatching(ocrName);
  const cleanOcrLeague = ocrLeague ? normalizeLeagueNameForOCR(ocrLeague) : '';
  const ocrNumbers = ocrName.match(/\d+/g);

  // STEP 2: Prioritize clubs with matching digits
  let prioritizedClubsList: any[] | null = null;
  if (ocrNumbers && ocrNumbers.length > 0) {
    prioritizedClubsList = [];
    const otherClubsList: any[] = [];
    for (const [normalized, data] of clubMap.entries()) {
      const clubNumbers = data.club.match(/\d+/g);
      const hasMatchingNumbers = clubNumbers?.some((num) => ocrNumbers.includes(num));
      const entry = {
        id: normalized,
        league: data.league || '',
        name: data.club,
        normalizedLeague: normalizeLeagueNameForOCR(data.league || ''),
        normalizedName: normalizeTextForMatching(data.club)
      };
      if (hasMatchingNumbers) prioritizedClubsList.push(entry);
      else otherClubsList.push(entry);
    }
    prioritizedClubsList = prioritizedClubsList.concat(otherClubsList);
  }

  // KROK 3: Fuse.js fuzzy matching
  try {
    const clubsList =
      prioritizedClubsList ||
      [...clubMap.entries()].map(([normalized, data]) => ({
        id: normalized,
        league: data.league || '',
        name: data.club,
        normalizedLeague: normalizeLeagueNameForOCR(data.league || ''),
        normalizedName: normalizeTextForMatching(data.club)
      }));

    const nameLength = cleanOcrName.length;
    const dynamicThreshold = nameLength <= 4 ? 0.5 : nameLength <= 8 ? 0.45 : 0.4;

    const fuse = new Fuse(clubsList, {
      findAllMatches: false,
      ignoreLocation: true,
      includeScore: true,
      keys: filterByLeague
        ? [{ name: 'normalizedName', weight: 1 }]
        : [
            { name: 'normalizedName', weight: 0.7 },
            { name: 'normalizedLeague', weight: 0.3 }
          ],
      minMatchCharLength: 3,
      threshold: dynamicThreshold
    });

    let searchResults: any[];
    if (filterByLeague) {
      searchResults = fuse.search(cleanOcrName);
    } else if (cleanOcrLeague) {
      searchResults = fuse.search({
        normalizedLeague: cleanOcrLeague,
        normalizedName: cleanOcrName
      });
      if (searchResults.length === 0) searchResults = fuse.search(cleanOcrName);
    } else {
      searchResults = fuse.search(cleanOcrName);
    }

    if (searchResults.length > 0) {
      let best = searchResults[0];
      if (ocrNumbers && ocrNumbers.length > 0 && searchResults.length > 1) {
        for (const result of searchResults) {
          const matchedData = clubMap.get(result.item.id);
          const clubNumbers = matchedData?.club.match(/\d+/g);
          if (clubNumbers?.some((num: string) => ocrNumbers.includes(num))) {
            best = result;
            break;
          }
        }
      }

      const matchedData = clubMap.get(best.item.id);
      if (!matchedData)
        return findBestClubMatchWithLeagueLevenshtein(ocrName, ocrLeague, clubMap, filterByLeague);

      const matchedNormalized = normalizeTextForMatching(matchedData.club);
      const realDistance = levenshteinDistance(cleanOcrName, matchedNormalized);
      const maxLen = Math.max(cleanOcrName.length, matchedNormalized.length);
      let similarity = maxLen > 0 ? 1 - realDistance / maxLen : 0;

      if (ocrNumbers && ocrNumbers.length > 0) {
        const matchedNumbers = matchedData.club.match(/\d+/g);
        if (matchedNumbers?.some((num: string) => ocrNumbers.includes(num))) {
          similarity = Math.min(1, similarity + 0.1);
        }
      }

      const minNameSimilarity = getMinNameSimilarity(cleanOcrName, matchedNormalized);
      if (similarity < minNameSimilarity) return null;

      const leagueMatch = filterByLeague
        ? true
        : cleanOcrLeague && matchedData.league
          ? leaguesMatch(ocrLeague, matchedData.league)
          : false;
      return {
        club: matchedData.club,
        country: matchedData.country || null,
        league: matchedData.league,
        leagueMatch,
        nameSimilarity: similarity,
        score: similarity
      };
    }
  } catch {
    // fallback to Levenshtein
  }

  return findBestClubMatchWithLeagueLevenshtein(ocrName, ocrLeague, clubMap, filterByLeague);
}

export function findBestClubMatchWithLeagueLevenshtein(
  ocrName: string,
  ocrLeague: string,
  clubMap: Map<string, ClubData>,
  filterByLeague = false
): ClubMatchResult | null {
  if (!ocrName) return null;
  const cleanOcrName = normalizeTextForMatching(ocrName);
  let bestMatch: ClubMatchResult | null = null;
  let bestScore = 0;
  const baseMinScore = 0.5 - (Math.min(cleanOcrName.length, 10) < 5 ? 0.1 : 0);

  for (const [, data] of clubMap.entries()) {
    const cleanRealName = normalizeTextForMatching(data.club);
    const nameDistance = levenshteinDistance(cleanOcrName, cleanRealName);
    const maxNameLen = Math.max(cleanOcrName.length, cleanRealName.length);
    let nameSimilarity = maxNameLen > 0 ? 1 - nameDistance / maxNameLen : 0;
    if (maxNameLen <= 10 && nameDistance === 1) nameSimilarity = Math.max(nameSimilarity, 0.85);

    let containmentBonus = 0;
    if (cleanRealName.includes(cleanOcrName) || cleanOcrName.includes(cleanRealName))
      containmentBonus = 0.2;

    let leagueBonus = 0;
    let leagueMatch = false;
    if (filterByLeague) {
      leagueMatch = true;
    } else if (ocrLeague && data.league) {
      if (leaguesMatch(ocrLeague, data.league)) {
        leagueBonus = 0.3;
        leagueMatch = true;
      }
    } else if (!ocrLeague && !data.league) {
      leagueBonus = 0.05;
    }

    const totalScore = nameSimilarity + containmentBonus + leagueBonus;
    const minNameSimilarity = getMinNameSimilarity(cleanOcrName, cleanRealName);
    const isReasonable =
      nameSimilarity >= minNameSimilarity || (containmentBonus > 0 && nameSimilarity >= 0.5);

    if (totalScore > bestScore && totalScore >= baseMinScore && isReasonable) {
      bestScore = totalScore;
      bestMatch = {
        club: data.club,
        country: data.country || null,
        league: data.league,
        leagueMatch,
        nameSimilarity,
        score: totalScore
      };
    }
  }
  return bestMatch;
}

export function findExactClubMatch(
  ocrName: string,
  clubMap: Map<string, ClubData>
): ClubMatchResult | null {
  const cleanOcrName = normalizeTextForMatching(ocrName);
  for (const [, data] of clubMap.entries()) {
    if (cleanOcrName === normalizeTextForMatching(data.club)) {
      return {
        club: data.club,
        country: data.country || null,
        league: data.league,
        leagueMatch: true,
        nameSimilarity: 1,
        score: 1
      };
    }
  }
  return null;
}

/**
 * The league name without "serie a" to "serie d" and the whitespace before it.
 *
 * The whitespace is matched as `(?:(?<!\s)\s+)?`, so a match starts only where a whitespace run
 * starts; a plain `\s*` retried from every position of a long run (quadratic time) and found
 * the same matches.
 */
export function withoutSerieSuffix(text: string): string {
  return text.replaceAll(/(?:(?<!\s)\s+)?serie\s*[a-d]/gi, '').trim();
}

export function leaguesMatch(ocrLeague: string, dataLeague: string): boolean {
  if (!ocrLeague || !dataLeague) return false;
  const normOcr = normalizeLeagueNameForOCR(ocrLeague);
  const normData = normalizeLeagueNameForOCR(dataLeague);
  if (normOcr === normData) return true;
  if (normData.includes(normOcr)) return true;
  if (normOcr.includes(normData)) return true;

  const ocrBase = withoutSerieSuffix(normOcr);
  const dataBase = withoutSerieSuffix(normData);
  if (ocrBase && dataBase && ocrBase === dataBase) {
    const ocrHasSerie = /serie\s*[a-d]/i.test(normOcr);
    const dataHasSerie = /serie\s*[a-d]/i.test(normData);
    if (!ocrHasSerie && dataHasSerie) return true;
    if (ocrHasSerie && dataHasSerie) {
      const ocrSerie = /serie\s*([a-d])/i.exec(normOcr);
      const dataSerie = /serie\s*([a-d])/i.exec(normData);
      if (ocrSerie?.[1].toLowerCase() === dataSerie?.[1].toLowerCase()) return true;
    }
  }
  return false;
}

export function normalizeLeagueNameForOCR(leagueName: string): string {
  if (!leagueName) return '';
  const corrected = leagueName
    .replaceAll(/\bIll\b/gi, 'III')
    .replaceAll(/\bIl\b/gi, 'II')
    .replaceAll(/ll\b/gi, 'II')
    .replaceAll(/\bl\b(?=\s*(?:Liga|liga|grupa|group|serie|série|division))/gi, 'I');
  return normalizeDiacritics(corrected.toLowerCase().trim()) ?? '';
}

export function normalizeTextForMatching(text: string): string {
  if (!text) return '';
  const corrected = correctCommonOCRErrors(text);
  return normalizeDiacritics(corrected.toLowerCase().trim()) ?? '';
}

function getMinNameSimilarity(cleanOcrName: string, cleanRealName: string): number {
  let minNameSimilarity = 0.7;
  const ocrLen = cleanOcrName.length;
  const realLen = cleanRealName.length;
  const lenDiff = Math.abs(ocrLen - realLen);
  if (lenDiff > Math.max(ocrLen, realLen) * 0.3) minNameSimilarity = 0.75;
  if (ocrLen < 8) minNameSimilarity = Math.max(minNameSimilarity, 0.75);
  if (lenDiff > Math.max(ocrLen, realLen) * 0.5) minNameSimilarity = 0.8;
  if (ocrLen < 6 && realLen > 10) {
    const isContained =
      cleanRealName.includes(cleanOcrName) || cleanOcrName.includes(cleanRealName);
    if (!isContained) minNameSimilarity = Math.max(minNameSimilarity, 0.8);
  }
  const ocrWords = cleanOcrName.split(/\s+/).filter((w) => w.length >= 3);
  const realWords = new Set(cleanRealName.split(/\s+/).filter((w) => w.length >= 3));
  const commonWords = ocrWords.filter((w) => realWords.has(w));
  if (commonWords.length > 0) {
    if (levenshteinDistance(cleanOcrName, cleanRealName) / Math.max(ocrLen, realLen) > 0.2) {
      minNameSimilarity = Math.max(minNameSimilarity, 0.8);
    }
  } else {
    minNameSimilarity = Math.max(minNameSimilarity, 0.85);
  }
  return minNameSimilarity;
}
