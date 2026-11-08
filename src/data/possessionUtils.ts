import { IMPORT_LIMITS } from '@/config/importLimits';

import { normalizeDiacritics } from '../utils/helpers';

export function normalizeClubName(name: unknown): string {
  if (!name) return '';
  const s = normalizeDiacritics(String(name).trim());
  return s.toLowerCase();
}

export function getTeamPossession(map: Map<string, number>, clubName: unknown): null | number {
  if (!clubName && clubName !== 0) return null;
  const norm = normalizeClubName(clubName);
  if (!norm) return null;
  const val = map.get(norm);
  return typeof val === 'number' ? val : null;
}

export function setTeamPossession(
  map: Map<string, number>,
  clubName: unknown,
  possession: unknown
): void {
  if (!clubName && clubName !== 0) return;
  const norm = normalizeClubName(clubName);
  if (!norm) return;
  let val =
    typeof possession === 'number' ? possession : parseFloat(String(possession).replace(',', '.'));
  if (isNaN(val)) return;
  val = Math.round(val);
  val = Math.max(0, Math.min(100, val));
  map.set(norm, val);
}

export function removeTeamPossession(map: Map<string, number>, clubName: unknown): void {
  if (!map) return;
  const normalized = normalizeClubName(clubName);
  if (map.has(normalized)) {
    map.delete(normalized);
  }
}

export function resetTeamPossession(map: Map<string, number>): void {
  map.clear();
}

const POSSESSION_LINE_RE =
  /^\s*(.+?)[\u000A-\u000D \u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*(?:\t|(?:\t\s*)?[-:;])\s*([\d.,]+)\s*(?:%\s*)?$/;

export function updatePossessionMapFromText(map: Map<string, number>, textData: unknown): void {
  if (!textData) return;
  const lines = String(textData).split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    // No club name with its percentage is this long; POSSESSION_LINE_RE is super-linear on long lines.
    if (!line || line.length > IMPORT_LIMITS.pastedLineLengthChars) continue;
    const match = POSSESSION_LINE_RE.exec(line);
    if (!match) continue;
    const clubName = match[1].trim();
    const val = parseFloat(match[2].trim().replace(',', '.'));
    if (isNaN(val)) continue;
    setTeamPossession(map, clubName, val);
  }
}
