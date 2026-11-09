import { extractAgeFromDob } from './extractAgeFromDob';

// The date-of-birth cell of the same players in the 18 export languages of Football Manager.
const SUFFIXES_BY_LANGUAGE = [
  ['da', '16.9.1992 (31 år gammel)', 31],
  ['de', '16.9.1992 (31 Jahre alt)', 31],
  ['el', '19.6.2002 (21 ετών)', 21],
  ['en', '16.9.1992 (31 years old)', 31],
  ['es', '16.9.1992 (31 años)', 31],
  ['fr', '19.6.2002 (21 ans)', 21],
  ['it', '19.6.2002 (21 anni)', 21],
  ['ja', '19.6.2002（21歳）', 21],
  ['ko', '19일.6월.2002년 (21세)', 21],
  ['nl', '19.6.2002 (21 jaar)', 21],
  ['no', '19.6.2002 (21 år gammel)', 21],
  ['pl', '19.6.2002 (21 l.)', 21],
  ['pt', '19.6.2002 (21 anos)', 21],
  ['ru', '19.6.2002 (21 год)', 21],
  ['sv', '19.6.2002 (21 år gammal)', 21],
  ['tr', '19.6.2002 (21 yaşında)', 21],
  ['zh', '19.6.2002(21岁)', 21]
] as const;

describe('extractAgeFromDob', () => {
  it.each(SUFFIXES_BY_LANGUAGE)('reads the %s suffix', (_language, cell, age) => {
    expect(extractAgeFromDob(cell)).toBe(age);
  });

  it('reads a suffix without a space or with a singular unit', () => {
    expect(extractAgeFromDob('25.1.2006 (18l.)')).toBe(18);
    expect(extractAgeFromDob('1/2/2024 (1 year old)')).toBe(1);
    expect(extractAgeFromDob(' 16.9.1992 (31 years old) ')).toBe(31);
  });

  it('returns null without an age in a closing parenthesis', () => {
    expect(extractAgeFromDob('16.9.1992')).toBeNull();
    expect(extractAgeFromDob('16.9.1992 (unknown)')).toBeNull();
    expect(extractAgeFromDob('16.9.1992 (31 years old')).toBeNull();
    expect(extractAgeFromDob('(31) 16.9.1992')).toBeNull();
    expect(extractAgeFromDob('')).toBeNull();
    expect(extractAgeFromDob(null)).toBeNull();
    expect(extractAgeFromDob(undefined)).toBeNull();
  });
});
