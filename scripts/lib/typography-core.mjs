// Pure helpers for check:typography: the repository bans the em dash (U+2014) and emoji.
// Patterns use escapes so this file passes its own check.

export const TYPOGRAPHY_CONFIG = Object.freeze({
  excludedPrefixes: Object.freeze(['goldens/', 'e2e/fixtures/', 'public/vendor/']),
  binarySniffBytes: 8000
});

const ISSUE_PATTERN = /(\u2014)|(\p{Emoji_Presentation}|\uFE0F)/gu;

export function isCheckedPath(filePath) {
  const normalised = filePath.replaceAll('\\', '/');
  return !TYPOGRAPHY_CONFIG.excludedPrefixes.some((prefix) => normalised.startsWith(prefix));
}

export function isProbablyText(buffer) {
  return !buffer.subarray(0, TYPOGRAPHY_CONFIG.binarySniffBytes).includes(0);
}

export function findTypographyIssues(text) {
  return text.split('\n').flatMap((lineText, index) =>
    [...lineText.matchAll(ISSUE_PATTERN)].map((match) => ({
      line: index + 1,
      column: match.index + 1,
      kind: match[1] ? 'em-dash' : 'emoji'
    }))
  );
}
