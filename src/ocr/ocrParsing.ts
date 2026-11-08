// Phase 5F: OCR text parsing – migrated from main.js
import { getProcessor } from '../lib/processorBridge';

import {
  type ClubData,
  correctCommonOCRErrors,
  findBestClubMatchWithLeague,
  leaguesMatch,
  normalizeTextForMatching
} from './ocrMatching';

export interface OCRParseResult {
  errors: string[];
  league: null | string;
  results: OCRResult[];
}

export interface OCRResult {
  _resultId?: string;
  corrected: boolean;
  correctedOCR: null | string;
  country: null | string;
  league: null | string;
  leagueConfidence?: number;
  leagueMatch: boolean;
  lowConfidenceWarning?: boolean;
  manuallyEdited?: boolean;
  matched: string;
  ocrConfidence?: number;
  ocrLeague: null | string;
  original: string;
  possession: number;
  score?: number;
  sourceFile?: string;
  warning?: null | string;
}

const referenceDatabase = {
  clubs: new Set<string>(),
  initialized: false,
  leagues: new Set<string>()
};

export function extractClubsWithLeagues(): Map<string, ClubData> {
  const clubMap = new Map<string, ClubData>();
  const proc = getProcessor();
  if (!proc) return clubMap;
  const source: any[] = proc.calculatedScores.length > 0 ? proc.calculatedScores : proc.mergedData;
  source.forEach((player) => {
    const club = player.club || player.Club;
    const league = player.league || player.Division || '';
    const country = player['Based In'] || '';
    if (!club || typeof club !== 'string') return;
    const normalized = proc.normalizeClubName(club);
    const key = `${normalized}|${country}`;
    if (!clubMap.has(key)) clubMap.set(key, { club, country, league, players: [] });
    clubMap.get(key).players.push(player);
  });
  return clubMap;
}

export function updateReferenceDatabase(): void {
  const proc = getProcessor();
  if (!proc) return;
  referenceDatabase.clubs.clear();
  referenceDatabase.leagues.clear();
  const source: any[] = proc.calculatedScores.length > 0 ? proc.calculatedScores : proc.mergedData;
  source.forEach((player) => {
    const club = player.club || player.Club;
    const league = player.league || player.Division || '';
    if (club && typeof club === 'string') referenceDatabase.clubs.add(club);
    if (league && typeof league === 'string') referenceDatabase.leagues.add(league);
  });
  referenceDatabase.initialized = true;
}

const POSSESSION_PATTERNS = [
  /^\d+(st|nd|rd|th|\.)\s+(.+?)\s*[-:]\s*(\d{1,3}(?:[.,]\d+)?)\s?%$/,
  /^\d+(st|nd|rd|th|\.)\s+(.+?)\s+(\d{1,3}(?:[.,]\d+)?)\s?%$/,
  /^(\d{1,3}(?:[.,]\d+)?)\s?%\s+(.+)$/,
  /^(.+?)\s*[-:]\s*(\d{1,3}(?:[.,]\d+)?)\s?%$/,
  /^(.+?)\s+(\d{1,3}(?:[.,]\d+)?)\s?%$/,
  /^(.+?)\s*[-:]\s*(\d{1,3}[.,]\d+)\s?%$/,
  /^(.+?)\s*(?:[-:]\s*)?(\d{1,3}(?:[.,]\d+)?)$/,
  /^(.+?)\s*\((\d{1,3}(?:[.,]\d+)?)\s?%?\)$/
];

export function parseOCRText(
  text: string,
  ocrType: 'league' | 'table' = 'table',
  detectedLeague: null | string = null
): OCRParseResult | string {
  const correctedText = correctCommonOCRErrors(text);
  const lines = correctedText.split('\n').filter((line) => line.trim().length > 0);

  if (ocrType === 'league') {
    const ignoredPatterns = [
      /^(team|stats|possession|overview|matches|news|transfers|average|avg|general|form)/i,
      /^(avg\.?\s*poss|matches|pos|pas|ps\s*c|headers|cards|points|games|minutes)/i
    ];
    let bestLeague: null | string = null;
    let bestScore = 0;
    for (const line of lines) {
      const clean = line.trim();
      if (clean.includes('%') || /^\d+/.test(clean) || clean.length < 5) continue;
      if (ignoredPatterns.some((p) => p.test(clean))) continue;
      let score = clean.length;
      if (/campeonato|serie|division|liga|league|premier|championship/i.test(clean)) score += 20;
      if (/\b(de|da|do|del|della|van|von)\b/i.test(clean)) score += 10;
      if (score > bestScore) {
        bestScore = score;
        bestLeague = clean;
      }
    }
    return bestLeague || '';
  }

  const results: OCRResult[] = [];
  const errors: string[] = [];

  // STEP 1: Detect the league from the header
  const leagueCandidates: { position: number; score: number; text: string }[] = [];
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim();
    if (line.includes('%') || /^\d+/.test(line) || line.length < 5) continue;
    if (/^(avg|matches|pos|pas|ps\s*c)/i.test(line)) continue;
    if (/^(team|stats|possession|overview|matches|news|transfers)/i.test(line)) continue;
    if (
      /\d+/.test(line) &&
      line.length < 20 &&
      (/^[A-Z]+\s+\d+/i.test(line) || /^\d+\s+[A-Z]+/i.test(line))
    )
      continue;
    let score = line.length;
    if (/campeonato|serie|division|liga|league|premier|championship/i.test(line)) score += 20;
    if (/\b(de|da|do|del|della|van|von)\b/i.test(line)) score += 10;
    if (line.length > 8 && score > line.length)
      leagueCandidates.push({ position: i, score, text: line });
  }
  if (leagueCandidates.length > 0) {
    leagueCandidates.sort((a, b) =>
      Math.abs(a.score - b.score) > 5 ? b.score - a.score : a.position - b.position
    );
    detectedLeague = correctCommonOCRErrors(leagueCandidates[0].text);
  }

  // STEP 2: Extract clubs from the data
  const clubMap = extractClubsWithLeagues();
  let filteredClubMap = clubMap;
  let useFilteredOnly = false;

  if (detectedLeague && clubMap.size > 0) {
    filteredClubMap = new Map<string, ClubData>();
    clubMap.forEach((data, normalized) => {
      if (leaguesMatch(detectedLeague, data.league)) filteredClubMap.set(normalized, data);
    });
    if (filteredClubMap.size < 3) {
      filteredClubMap = clubMap;
      useFilteredOnly = false;
    } else {
      useFilteredOnly = true;
    }
  }

  // STEP 3: Parse each line
  lines.forEach((line, lineIndex) => {
    const cleanLine = line.trim();
    if (!cleanLine) return;

    let match: null | RegExpMatchArray = null;
    let clubName: null | string = null;
    let possession: null | number = null;

    for (const [patternIndex, POSSESSION_PATTERN] of POSSESSION_PATTERNS.entries()) {
      match = POSSESSION_PATTERN.exec(cleanLine);
      if (match) {
        switch (patternIndex) {
          case 0: {
            clubName = match[2].trim();
            possession = parsePossessionValue(match[3]);

            break;
          }
          case 1: {
            clubName = match[2].trim();
            possession = parsePossessionValue(match[3]);

            break;
          }
          case 2: {
            possession = parsePossessionValue(match[1]);
            clubName = match[2].trim();

            break;
          }
          default: {
            clubName = match[1].trim();
            possession = parsePossessionValue(match[2]);
          }
        }
        break;
      }
    }

    if (
      !match ||
      !clubName ||
      possession === null ||
      isNaN(possession) ||
      possession < 0 ||
      possession > 100
    ) {
      errors.push(`Linia ${lineIndex + 1}: "${cleanLine}" - nie rozpoznano`);
      return;
    }
    if (clubName.length < 2) {
      errors.push(`Linia ${lineIndex + 1}: "${cleanLine}" - nieprawidłowa nazwa klubu (za krótka)`);
      return;
    }
    if (/^\d+$/.test(clubName.trim())) {
      errors.push(
        `Linia ${lineIndex + 1}: "${cleanLine}" - nieprawidłowa nazwa klubu (tylko cyfry)`
      );
      return;
    }
    clubName = clubName.replace(/^\d+(st|nd|rd|th|\.)\s+/i, '').trim();
    if (!clubName || clubName.length < 2) {
      errors.push(
        `Linia ${lineIndex + 1}: "${cleanLine}" - nieprawidłowa nazwa klubu po czyszczeniu`
      );
      return;
    }
    if (!/[A-Za-zÀ-ÿ]/.test(clubName)) {
      errors.push(
        `Linia ${lineIndex + 1}: "${cleanLine}" - nieprawidłowa nazwa klubu (brak liter)`
      );
      return;
    }

    const originalClubNameOCR = clubName;
    const correctedClubName = correctCommonOCRErrors(clubName);
    const wasOCRCorrected = originalClubNameOCR !== correctedClubName;
    clubName = correctedClubName;

    if (filteredClubMap.size > 0) {
      const matchInfo = findBestClubMatchWithLeague(
        clubName,
        detectedLeague || '',
        filteredClubMap,
        useFilteredOnly
      );
      if (matchInfo) {
        const normalizedMatched = normalizeTextForMatching(matchInfo.club);
        let existingIndex = -1;
        for (const [i, result] of results.entries()) {
          if (normalizeTextForMatching(result.matched) === normalizedMatched) {
            existingIndex = i;
            break;
          }
        }
        const newResult: OCRResult = {
          corrected: matchInfo.nameSimilarity < 1 || wasOCRCorrected,
          correctedOCR: wasOCRCorrected ? correctedClubName : null,
          country: matchInfo.country || null,
          league: matchInfo.league,
          leagueMatch: matchInfo.leagueMatch,
          matched: matchInfo.club,
          ocrLeague: detectedLeague,
          original: originalClubNameOCR,
          possession: possession,
          score: matchInfo.score,
          warning:
            !matchInfo.leagueMatch && detectedLeague && useFilteredOnly
              ? 'Liga może się nie zgadzać'
              : null
        };
        if (existingIndex >= 0) {
          if (matchInfo.score > (results[existingIndex].score || 0))
            results[existingIndex] = newResult;
        } else {
          results.push(newResult);
        }
      } else {
        results.push({
          corrected: wasOCRCorrected,
          correctedOCR: wasOCRCorrected ? correctedClubName : null,
          country: null,
          league: null,
          leagueMatch: false,
          matched: correctedClubName || originalClubNameOCR,
          ocrLeague: detectedLeague,
          original: originalClubNameOCR,
          possession: possession,
          warning: 'Nie znaleziono dopasowania w liście klubów'
        });
      }
    } else {
      results.push({
        corrected: false,
        correctedOCR: null,
        country: null,
        league: null,
        leagueMatch: false,
        matched: clubName,
        ocrLeague: detectedLeague,
        original: clubName,
        possession: possession
      });
    }
  });

  return { errors, league: detectedLeague, results };
}

function parsePossessionValue(val: string): number {
  return parseFloat(String(val).replace(',', '.'));
}
