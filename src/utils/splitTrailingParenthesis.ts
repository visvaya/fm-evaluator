import { codeAt, isLineTerminator, isRegexWhitespace } from './regexCharClasses';

/**
 * Splits "D/WB (L)" into ["D/WB", "L"]: the text before a final parenthesised part and the
 * text inside it.
 *
 * Returns the same parts as the former pattern `^(.+?)\s*\(([^)]+)\)$`, in linear time instead
 * of its polynomial backtracking on long runs of whitespace or opening brackets. The inner part
 * starts at the first "(" after the last inner ")" and is not empty; the head drops the
 * whitespace before that "(", keeps at least one character and holds no line terminator.
 * The equivalence is tested against the former pattern.
 */
export function splitTrailingParenthesis(text: string): null | readonly [string, string] {
  const last = text.length - 1;
  if (text.charAt(last) !== ')') return null;
  const lastInnerClose = text.lastIndexOf(')', last - 1);
  const open = text.indexOf('(', Math.max(1, lastInnerClose + 1));
  if (open === -1 || open > last - 2) return null;
  let headEnd = open;
  while (headEnd > 1 && isRegexWhitespace(codeAt(text, headEnd - 1))) headEnd--;
  for (let i = 0; i < headEnd; i++) {
    if (isLineTerminator(codeAt(text, i))) return null;
  }
  return [text.slice(0, headEnd), text.slice(open + 1, last)];
}
