import { extractAgeFromDob } from './extractAgeFromDob';

describe('extractAgeFromDob', () => {
  it('reads the Polish suffix', () => {
    expect(extractAgeFromDob('25.1.2006 (18 l.)')).toBe(18);
    expect(extractAgeFromDob('25.1.2006 (18l.)')).toBe(18);
  });

  it('reads the English suffix', () => {
    expect(extractAgeFromDob('16.9.1992 (31 years old)')).toBe(31);
    expect(extractAgeFromDob('1/2/2024 (1 year old)')).toBe(1);
  });

  it('returns null without a recognised suffix', () => {
    expect(extractAgeFromDob('16.9.1992')).toBeNull();
    expect(extractAgeFromDob('16.9.1992 (31 ans)')).toBeNull();
    expect(extractAgeFromDob('')).toBeNull();
    expect(extractAgeFromDob(null)).toBeNull();
    expect(extractAgeFromDob(undefined)).toBeNull();
  });
});
