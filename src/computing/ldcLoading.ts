/* eslint-disable fp/no-let, fp/no-mutation, fp/no-mutating-methods, sonarjs/cognitive-complexity, no-restricted-syntax -- Legacy LDC import/loading paths were extracted structurally from the old monolith and remain intentionally imperative. */

import { canonicalizeNation } from './ldcNations';

import type { LeagueData } from '../config/ldcConfig';

function parseStars(rawValue: string): null | number {
  if (rawValue.trim().length === 0) {
    return null;
  }

  const value = Number.parseFloat(rawValue.trim().replace(',', '.'));
  return Number.isFinite(value) && value >= 0.5 && value <= 5 && Number.isInteger(value * 2)
    ? value
    : null;
}

// Kept Promise-returning so callers stay unchanged; the data is read synchronously.
export function loadDefaultLDCData(): Promise<LeagueData[]> {
  const embeddedData =
    window.DEFAULT_LEAGUE_DATA ||
    ((window as any).DEFAULT_LEAGUE_DATA === undefined
      ? null
      : (window as any).DEFAULT_LEAGUE_DATA);

  if (embeddedData && Array.isArray(embeddedData) && embeddedData.length > 0) {
    return Promise.resolve(
      embeddedData.map((league: any, index: number) => ({
        inputScore: 0,
        ldcRaw: 0,
        multiplier: 1,
        name: league.name,
        nation: canonicalizeNation(league.nation),
        rank: index + 1,
        // Stars are preserved regardless of the active model so that switching
        // to the basket model later can use the real curated values.
        stars: league.stars || null
      }))
    );
  }

  // No league file is fetched: embedded-data.js is the only source of the
  // default list. UI messaging is the caller's responsibility; this layer only reports.
  console.error('Embedded league data (DEFAULT_LEAGUE_DATA) is not available.');
  if (window.addAudit) {
    window.addAudit('ldc_load_default_error', { error: 'no-embedded-data' }, 'error');
  }
  return Promise.resolve([]);
}

export function parseLDCCSV(text: string): LeagueData[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((header) => header.trim());
  const nameIndex = headers.findIndex((header) => header.toLowerCase().includes('name'));
  const nationIndex = headers.findIndex((header) => header.toLowerCase().includes('nation'));
  const starsIndex = headers.findIndex(
    (header) => header.toLowerCase().includes('star') || header.toLowerCase().includes('reputation')
  );

  const leagues: LeagueData[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;

    for (let charIndex = 0; charIndex < lines[lineIndex].length; charIndex += 1) {
      const char = lines[lineIndex][charIndex];
      if (char === '"') {
        if (inQuotes && lines[lineIndex][charIndex + 1] === '"') {
          // Escaped double quote inside a quoted value.
          currentValue += '"';
          charIndex += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }

    values.push(currentValue.trim());

    const name = nameIndex === -1 ? values[0] || '' : values[nameIndex] || '';
    const nation = canonicalizeNation(
      nationIndex === -1 ? values[1] || '' : values[nationIndex] || ''
    );
    const stars = starsIndex !== -1 && values[starsIndex] ? parseStars(values[starsIndex]) : null;

    if (name) {
      leagues.push({
        inputScore: 0,
        ldcRaw: 0,
        multiplier: 1,
        name,
        nation,
        rank: leagues.length + 1,
        stars
      });
    }
  }

  return leagues;
}

export function parseLDCHTML(html: string): LeagueData[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return [];

  const rows = [...table.querySelectorAll('tr')].slice(1);
  const leagues: LeagueData[] = [];

  rows.forEach((row, index) => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 2) {
      return;
    }

    const name = cells[0]?.textContent?.trim() || '';
    const nation = canonicalizeNation(cells[1]?.textContent?.trim() || '');
    const reputation = cells[2]?.textContent?.trim() || '';

    if (name) {
      leagues.push({
        inputScore: 0,
        ldcRaw: 0,
        multiplier: 1,
        name,
        nation,
        rank: index + 1,
        stars: parseStars(reputation)
      });
    }
  });

  return leagues;
}
