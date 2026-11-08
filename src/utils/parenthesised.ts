import { codeAt, isRegexWhitespace } from './regexCharClasses';

/**
 * The first "(...)" with at least one character inside, such as "(RLC)" in "D/WB (RLC)".
 *
 * Same result as the former `/\([^)]+\)/.exec(text)?.[0]`, in linear time: that pattern retried
 * from every "(" and scanned to the end of the text when no ")" followed.
 */
export function firstParenthesised(text: string): null | string {
  let open = text.indexOf('(');
  while (open !== -1) {
    const close = text.indexOf(')', open + 1);
    if (close === -1) return null;
    if (close > open + 1) return text.slice(open, close + 1);
    open = text.indexOf('(', close + 1);
  }
  return null;
}

/**
 * The text without a final "(...)" and the whitespace around it: "AM (RL) " gives "AM".
 *
 * Same result as the former `text.replace(/\s*\([^)]+\)\s*$/, '')`, in linear time: the inner
 * part starts at the first "(" after the last inner ")" and is not empty.
 */
export function withoutTrailingParenthesis(text: string): string {
  let end = text.length;
  while (end > 0 && isRegexWhitespace(codeAt(text, end - 1))) end--;
  const close = end - 1;
  if (close < 0 || text.charAt(close) !== ')') return text;
  const innerClose = close === 0 ? -1 : text.lastIndexOf(')', close - 1);
  const open = text.indexOf('(', innerClose + 1);
  if (open === -1 || open > close - 2) return text;
  let start = open;
  while (start > 0 && isRegexWhitespace(codeAt(text, start - 1))) start--;
  return text.slice(0, start);
}
