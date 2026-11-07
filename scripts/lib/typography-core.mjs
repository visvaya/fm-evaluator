// Pure helpers for check:typography: the repository bans the em dash (U+2014), emoji, bidi control
// characters (Trojan Source) and external CDN hosts (the CSP allows only the app's own origin).
// Patterns use escapes or code points so this file passes its own check.

export const TYPOGRAPHY_CONFIG = Object.freeze({
  excludedPrefixes: Object.freeze(['goldens/', 'e2e/fixtures/', 'public/vendor/']),
  binarySniffBytes: 8000
});

const ISSUE_PATTERN = /(\u2014)|(\p{Emoji_Presentation}|\uFE0F)/gu;

const codePointRange = (from, to) => `${String.fromCodePoint(from)}-${String.fromCodePoint(to)}`;

/** Embeddings, overrides and isolates (U+202A to U+202E, U+2066 to U+2069); not the LRM and RLM marks. */
const BIDI_PATTERN = new RegExp(
  `[${codePointRange(0x20_2a, 0x20_2e)}${codePointRange(0x20_66, 0x20_69)}]`,
  'gu'
);

/** Public CDN hosts, as regex sources with escaped dots, so this list passes its own check. */
export const CDN_HOST_SOURCES = Object.freeze([
  String.raw`unpkg\.com`,
  String.raw`cdn\.jsdelivr\.net`,
  String.raw`cdnjs\.cloudflare\.com`,
  String.raw`fonts\.googleapis\.com`,
  String.raw`fonts\.gstatic\.com`
]);

const CDN_PATTERN = new RegExp(`(?<![\\w.-])(?:${CDN_HOST_SOURCES.join('|')})\\b`, 'g');

export function isCheckedPath(filePath) {
  const normalised = filePath.replaceAll('\\', '/');
  return !TYPOGRAPHY_CONFIG.excludedPrefixes.some((prefix) => normalised.startsWith(prefix));
}

export function isProbablyText(buffer) {
  return !buffer.subarray(0, TYPOGRAPHY_CONFIG.binarySniffBytes).includes(0);
}

export function findTypographyIssues(text) {
  return text.split('\n').flatMap((lineText, index) => {
    const issue = (match, kind) => ({ line: index + 1, column: match.index + 1, kind });
    return [
      ...[...lineText.matchAll(ISSUE_PATTERN)].map((match) =>
        issue(match, match[1] ? 'em-dash' : 'emoji')
      ),
      ...[...lineText.matchAll(BIDI_PATTERN)].map((match) => issue(match, 'bidi')),
      ...[...lineText.matchAll(CDN_PATTERN)].map((match) => issue(match, 'cdn'))
    ].toSorted((left, right) => left.column - right.column);
  });
}
