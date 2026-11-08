// Character classes of JavaScript patterns without the `u` flag, for linear scanners that
// replace backtracking patterns and must classify each UTF-16 code unit exactly as they did.

const LINE_TERMINATOR_CODES = new Set([0x0a, 0x0d, 0x2028, 0x2029]);
// The code units matched by `\s`, apart from the two ranges tested below.
const SINGLE_WHITESPACE_CODES = new Set([
  0x20, 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff
]);

/** True for a code unit that `\s` matches. */
export function isRegexWhitespace(code: number): boolean {
  return (
    (code >= 0x09 && code <= 0x0d) ||
    (code >= 0x2000 && code <= 0x200a) ||
    SINGLE_WHITESPACE_CODES.has(code)
  );
}

/** True for a code unit that `.` does not match. */
export function isLineTerminator(code: number): boolean {
  return LINE_TERMINATOR_CODES.has(code);
}

/**
 * The code at `index`, or -1 past the end. A code point above U+FFFF belongs to none of the
 * classes above, exactly like the lone surrogate code unit a pattern without `u` sees.
 */
export function codeAt(text: string, index: number): number {
  return text.codePointAt(index) ?? -1;
}
