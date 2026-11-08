/**
 * Upper bounds for imported text. Real exports and settings files stay far below them (the longest
 * cell in the available exports had about 100 characters, measured 2026-11-08); the bounds keep
 * the work of the text helpers that run on every value small, whatever the input. The cell bound
 * is a sanity limit: every cut cell is counted and reported to the user after the import.
 */
export const IMPORT_LIMITS = {
  cellTextLengthChars: 10_000,
  leagueNameLengthChars: 200,
  pastedLineLengthChars: 300
} as const;
