/**
 * Splits a range such as "12-15" or "1K € - 6K €" at a hyphen, en dash or em dash.
 *
 * Returns the same parts as the former pattern `^\s*(.+?)\s*[-–\u2014]\s*(.+?)\s*$`, in
 * linear time instead of the pattern's polynomial backtracking on long runs of whitespace: the
 * left part ends at the first dash that leaves a valid right part, the whitespace around the
 * dash is dropped, and neither part may contain a line terminator. The equivalence is tested
 * against the former pattern.
 */
export function splitRange(text: string): null | readonly [string, string] {
  const scan = scanText(text);
  const lead = scan.skipSpace(0);
  for (let end = lead + 1; end <= text.length; end++) {
    if (isLineTerminator(codeAt(text, end - 1))) break;
    const dash = scan.skipSpace(end);
    const right = isDash(codeAt(text, dash)) ? rightPart(text, scan, dash + 1) : null;
    if (right !== null) return [text.slice(lead, end), right];
  }
  return leadingWhitespaceSplit(text, scan, lead);
}

// The former pattern could also give back leading whitespace when the text starts with a dash:
// the left part is then the last whitespace character before the dash that is not a line terminator.
function leadingWhitespaceSplit(
  text: string,
  scan: TextScan,
  lead: number
): null | readonly [string, string] {
  if (lead === 0 || !isDash(codeAt(text, lead))) return null;
  const right = rightPart(text, scan, lead + 1);
  if (right === null) return null;
  for (let i = lead - 1; i >= 0; i--) {
    if (!isLineTerminator(codeAt(text, i))) return [text.charAt(i), right];
  }
  return null;
}

// The part after the dash: whitespace on both sides dropped, no line terminator inside.
function rightPart(text: string, scan: TextScan, start: number): null | string {
  const first = scan.skipSpace(start);
  if (first < text.length) {
    return scan.terminatorFrom(first) <= scan.lastNonSpace
      ? null
      : text.slice(first, scan.lastNonSpace + 1);
  }
  // Only whitespace follows the dash: the former pattern took its last non-terminator character.
  return scan.lastNonTerminator >= start ? text.charAt(scan.lastNonTerminator) : null;
}

interface TextScan {
  lastNonSpace: number;
  lastNonTerminator: number;
  skipSpace: (index: number) => number;
  terminatorFrom: (index: number) => number;
}

// One pass from the right that answers every later question in constant time.
function scanText(text: string): TextScan {
  const length = text.length;
  const spaceEnd = new Int32Array(length + 1).fill(length);
  const terminatorAt = new Int32Array(length + 1).fill(length);
  let lastNonSpace = -1;
  let lastNonTerminator = -1;
  for (let i = length - 1; i >= 0; i--) {
    const code = codeAt(text, i);
    const space = isWhitespace(code);
    const terminator = isLineTerminator(code);
    spaceEnd[i] = space ? (spaceEnd[i + 1] ?? length) : i;
    terminatorAt[i] = terminator ? i : (terminatorAt[i + 1] ?? length);
    if (lastNonSpace < 0 && !space) lastNonSpace = i;
    if (lastNonTerminator < 0 && !terminator) lastNonTerminator = i;
  }
  return {
    lastNonSpace,
    lastNonTerminator,
    skipSpace: (index) => spaceEnd[index] ?? length,
    terminatorFrom: (index) => terminatorAt[index] ?? length
  };
}

// A code point above U+FFFF (or the end of the text) belongs to none of the classes below,
// exactly like the lone surrogate code unit the former pattern saw.
function codeAt(text: string, index: number): number {
  return text.codePointAt(index) ?? -1;
}

const DASH_CODES = new Set([0x2d, 0x2013, 0x2014]);
const LINE_TERMINATOR_CODES = new Set([0x0a, 0x0d, 0x2028, 0x2029]);
// The code units matched by `\s` in a pattern without the `u` flag, apart from two ranges.
const SINGLE_WHITESPACE_CODES = new Set([
  0x20, 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff
]);

function isDash(code: number): boolean {
  return DASH_CODES.has(code);
}

function isLineTerminator(code: number): boolean {
  return LINE_TERMINATOR_CODES.has(code);
}

function isWhitespace(code: number): boolean {
  return (
    (code >= 0x09 && code <= 0x0d) ||
    (code >= 0x2000 && code <= 0x200a) ||
    SINGLE_WHITESPACE_CODES.has(code)
  );
}
