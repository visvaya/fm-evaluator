import { IMPORT_LIMITS } from '@/config/importLimits';

import { normalizeDiacritics } from '../utils/helpers';
import { codeAt, isLineTerminator, isRegexWhitespace } from '../utils/regexCharClasses';

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

export function updatePossessionMapFromText(map: Map<string, number>, textData: unknown): void {
  if (!textData) return;
  const lines = String(textData).split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    // No club name with its percentage is this long.
    if (!line || line.length > IMPORT_LIMITS.pastedLineLengthChars) continue;
    const match = splitPossessionLine(line);
    if (!match) continue;
    const clubName = match[0].trim();
    const val = parseFloat(match[1].replace(',', '.'));
    if (isNaN(val)) continue;
    setTeamPossession(map, clubName, val);
  }
}

/**
 * Splits a trimmed line such as "Arsenal: 55%" or "Arsenal\t55" into the club name and the
 * number text.
 *
 * Returns the same parts as the former pattern on a trimmed line, in linear time instead of its
 * polynomial backtracking on long runs of whitespace (the pattern is quoted in the equivalence
 * test): the name ends at the first separator (a tab, or ":", ";" or "-" with an optional tab and
 * whitespace before it) after which only the number, whitespace and an optional "%" follow; the
 * whitespace before the separator is dropped, except tabs, and the name holds no line terminator.
 */
export function splitPossessionLine(line: string): null | readonly [string, string] {
  const number = trailingNumber(line);
  if (!number) return null;
  const isNumberStart = (index: number): boolean =>
    index >= number.spaceStart && index < number.end;
  const numberFrom = (index: number): string =>
    line.slice(Math.max(index, number.start), number.end);
  const spaceEnd = runEnds(line, isRegexWhitespace);
  const nonTabSpaceEnd = runEnds(line, (code) => code !== TAB && isRegexWhitespace(code));

  for (let end = 1; end <= line.length; end++) {
    if (isLineTerminator(codeAt(line, end - 1))) break;
    const separator = nonTabSpaceEnd[end] ?? line.length;
    const code = codeAt(line, separator);
    let afterSeparator = -1;
    if (code === TAB) {
      const mark = spaceEnd[separator + 1] ?? line.length;
      if (isNumberStart(separator + 1)) afterSeparator = separator + 1;
      else if (SEPARATOR_CODES.has(codeAt(line, mark))) afterSeparator = mark + 1;
    } else if (SEPARATOR_CODES.has(code)) {
      afterSeparator = separator + 1;
    }
    if (afterSeparator !== -1 && isNumberStart(afterSeparator)) {
      return [line.slice(0, end), numberFrom(afterSeparator)];
    }
  }
  return null;
}

const TAB = 0x09;
const SEPARATOR_CODES = new Set([0x2d, 0x3a, 0x3b]);
const PERCENT = 0x25;

function isNumberCode(code: number): boolean {
  return (code >= 0x30 && code <= 0x39) || code === 0x2c || code === 0x2e;
}

// The number at the end of the line: its digits run from `start` to `end`, and the whitespace
// directly before it starts at `spaceStart`. Only whitespace and one "%" may follow it.
function trailingNumber(line: string): null | { end: number; spaceStart: number; start: number } {
  let end = line.length;
  if (codeAt(line, end - 1) === PERCENT) {
    end--;
    while (end > 0 && isRegexWhitespace(codeAt(line, end - 1))) end--;
  }
  let start = end;
  while (start > 0 && isNumberCode(codeAt(line, start - 1))) start--;
  if (start === end) return null;
  let spaceStart = start;
  while (spaceStart > 0 && isRegexWhitespace(codeAt(line, spaceStart - 1))) spaceStart--;
  return { end, spaceStart, start };
}

// ends[i]: first index at or after i whose code fails `inRun`.
function runEnds(line: string, inRun: (code: number) => boolean): Int32Array {
  const ends = new Int32Array(line.length + 1).fill(line.length);
  for (let i = line.length - 1; i >= 0; i--) {
    ends[i] = inRun(codeAt(line, i)) ? (ends[i + 1] ?? line.length) : i;
  }
  return ends;
}
