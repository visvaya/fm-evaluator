import { describe, expect, it } from 'vitest';

import { assessLdcDataAvailability } from './ldcDataAvailability';

describe('assessLdcDataAvailability', () => {
  it('counts players with usable division and Based In data', () => {
    const rows = [
      { 'Based In': 'Anglia', Division: 'Premier League' },
      { Division: 'Ekstraklasa', Nation: 'Polska' },
      { Division: '-' },
      {}
    ];
    // Nation (player nationality) never counts as Based In (league country) -
    // scoring only reads Based In, so the row with only Nation is "missing".
    expect(assessLdcDataAvailability(rows)).toEqual({
      playersTotal: 4,
      playersWithDivision: 2,
      playersWithNation: 1
    });
  });

  it('returns zeros for empty input', () => {
    expect(assessLdcDataAvailability([])).toEqual({
      playersTotal: 0,
      playersWithDivision: 0,
      playersWithNation: 0
    });
  });
});
