import { codeAt, isLineTerminator } from '../utils/regexCharClasses';

/**
 * Reads the club name and the possession text from one trimmed OCR line, such as
 * "1st Arsenal - 55%", "55% Arsenal", "Arsenal 55.5%" or "Arsenal (55%)".
 *
 * Returns the same parts as the former list of eight patterns tried in order (the first match
 * won), in linear time. Those patterns started the name with a lazy `(.+?)` next to `\s*` or
 * `\s+`, which backtracks polynomially on long whitespace runs. The name here starts and ends
 * with a non-space character and grows from the shortest candidate, which is the part the lazy
 * group found on a trimmed line. The equivalence is tested against the former patterns.
 */
export function matchPossessionLine(line: string): null | readonly [string, string] {
  return (
    pick(RANKED_DASH.exec(line)) ??
    rankedWhitespaceName(line, RANKED_DASH_TAIL, 1) ??
    pick(RANKED_SPACE.exec(line)) ??
    rankedWhitespaceName(line, PERCENT_TAIL, 2) ??
    percentFirst(line) ??
    nameFirst(line)
  );
}

// "1st Arsenal - 55%" and "1. Arsenal 55%": rank, whitespace, name, number with "%".
const RANKED_DASH = /^\d+(?:st|nd|rd|th|\.)\s+(\S(?:.*?\S)??)\s*[-:]\s*(\d{1,3}(?:[.,]\d+)?)\s?%$/;
const RANKED_SPACE = /^\d+(?:st|nd|rd|th|\.)\s+(\S(?:.*?\S)??)\s+(\d{1,3}(?:[.,]\d+)?)\s?%$/;
const RANKED_HEAD = /^\d+(?:st|nd|rd|th|\.)(\s+)/;
const RANKED_DASH_TAIL = /^[-:]\s*(\d{1,3}(?:[.,]\d+)?)\s?%$/;
const PERCENT_TAIL = /^(\d{1,3}(?:[.,]\d+)?)\s?%$/;
// "55% Arsenal": the number first.
const PERCENT_FIRST = /^(\d{1,3}(?:[.,]\d+)?)\s?%\s+(\S.*)$/;
// The name first, in the former order. The former sixth pattern (a decimal number after a dash
// or colon) is left out: every line it matched also matches the first one here.
const NAME_FIRST = [
  /^(\S(?:.*?\S)??)\s*[-:]\s*(\d{1,3}(?:[.,]\d+)?)\s?%$/,
  /^(\S(?:.*?\S)??)\s+(\d{1,3}(?:[.,]\d+)?)\s?%$/,
  /^(\S(?:.*?\S)??)\s*(?:[-:]\s*)?(\d{1,3}(?:[.,]\d+)?)$/,
  /^(\S(?:.*?\S)??)\s*\((\d{1,3}(?:[.,]\d+)?)\s?%?\)$/
];

function pick(match: null | RegExpExecArray): null | readonly [string, string] {
  return match ? [match[1] ?? '', match[2] ?? ''] : null;
}

function percentFirst(line: string): null | readonly [string, string] {
  const match = PERCENT_FIRST.exec(line);
  return match ? [match[2] ?? '', match[1] ?? ''] : null;
}

function nameFirst(line: string): null | readonly [string, string] {
  for (const pattern of NAME_FIRST) {
    const match = pick(pattern.exec(line));
    if (match) return match;
  }
  return null;
}

// When no name fits after the rank, the former ranked patterns gave back whitespace from the
// run after the rank and took one whitespace character as the name ("1st  - 55%" gave " "),
// which the caller then rejects. `gap` is how many characters must stay between that character
// and the end of the run: 1 when a dash or colon follows, 2 when the number follows a space.
function rankedWhitespaceName(
  line: string,
  tail: RegExp,
  gap: number
): null | readonly [string, string] {
  const head = RANKED_HEAD.exec(line);
  if (!head) return null;
  const runEnd = head[0].length;
  const runStart = runEnd - (head[1] ?? '').length;
  const number = tail.exec(line.slice(runEnd));
  if (!number) return null;
  for (let i = runEnd - gap; i > runStart; i--) {
    if (!isLineTerminator(codeAt(line, i))) return [line.charAt(i), number[1] ?? ''];
  }
  return null;
}
