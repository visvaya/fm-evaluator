import { describe, expect, it } from 'vitest';

import { parseFeet } from './parseFeet';

describe('parseFeet', () => {
  // ── null / missing player ─────────────────────────────────────────────────

  it('returns {left:0, right:0} for null', () => {
    expect(parseFeet(null)).toEqual({ left: 0, right: 0 });
  });

  it('returns {left:0, right:0} for undefined', () => {
    expect(parseFeet(undefined)).toEqual({ left: 0, right: 0 });
  });

  it('returns {left:0, right:0} for empty object', () => {
    expect(parseFeet({})).toEqual({ left: 0, right: 0 });
  });

  // ── explicit Left Foot / Right Foot keys ──────────────────────────────────

  it('reads Left Foot and Right Foot string labels', () => {
    const player = { 'Left Foot': 'Very Strong', 'Right Foot': 'Weak' };
    const { left, right } = parseFeet(player);
    expect(left).toBe(5);
    expect(right).toBe(1);
  });

  it('reads basic_left_foot and basic_right_foot fallback keys', () => {
    const player = { basic_left_foot: 'Strong', basic_right_foot: 'Reasonable' };
    const { left, right } = parseFeet(player);
    expect(left).toBe(4);
    expect(right).toBe(2);
  });

  it('prefers Left Foot over basic_left_foot', () => {
    const player = {
      'Left Foot': 'Very Strong',
      basic_left_foot: 'Weak',
      'Right Foot': 'Weak',
      basic_right_foot: 'Weak'
    };
    expect(parseFeet(player).left).toBe(5);
  });

  // ── preferred foot fallback (when both explicit values are 0) ────────────

  it('uses Preferred Foot "Right" when no explicit keys', () => {
    const result = parseFeet({ 'Preferred Foot': 'Right' });
    expect(result).toEqual({ left: 1, right: 5 });
  });

  it('uses Preferred Foot "Left"', () => {
    expect(parseFeet({ 'Preferred Foot': 'Left' })).toEqual({ left: 5, right: 1 });
  });

  it('uses Preferred Foot "Either"', () => {
    expect(parseFeet({ 'Preferred Foot': 'Either' })).toEqual({ left: 5, right: 5 });
  });

  it('uses Preferred Foot "Right Only"', () => {
    expect(parseFeet({ 'Preferred Foot': 'Right Only' })).toEqual({ left: 0, right: 5 });
  });

  it('uses Preferred Foot "Left Only"', () => {
    expect(parseFeet({ 'Preferred Foot': 'Left Only' })).toEqual({ left: 5, right: 0 });
  });

  it('uses Polish Preferred Foot "Prawa"', () => {
    expect(parseFeet({ Noga: 'Prawa' })).toEqual({ left: 1, right: 5 });
  });

  it('uses Polish Preferred Foot "Lewa"', () => {
    expect(parseFeet({ Noga: 'Lewa' })).toEqual({ left: 5, right: 1 });
  });

  it('uses Polish Preferred Foot "Obie"', () => {
    expect(parseFeet({ Noga: 'Obie' })).toEqual({ left: 5, right: 5 });
  });

  it('uses Polish Preferred Foot "Tylko prawa"', () => {
    expect(parseFeet({ Noga: 'Tylko prawa' })).toEqual({ left: 0, right: 5 });
  });

  it('uses Polish Preferred Foot "Tylko lewa"', () => {
    expect(parseFeet({ Noga: 'Tylko lewa' })).toEqual({ left: 5, right: 0 });
  });

  it('reads basic_preferred_foot as fallback', () => {
    expect(parseFeet({ basic_preferred_foot: 'Right' })).toEqual({ left: 1, right: 5 });
  });

  it('returns {0,0} for unknown Preferred Foot value', () => {
    expect(parseFeet({ 'Preferred Foot': 'Unknown value' })).toEqual({ left: 0, right: 0 });
  });

  it('does not use Preferred Foot when explicit keys are present', () => {
    const player = {
      'Left Foot': 'Strong',
      'Right Foot': 'Weak',
      'Preferred Foot': 'Either'
    };
    const result = parseFeet(player);
    expect(result).toEqual({ left: 4, right: 1 });
  });
});
