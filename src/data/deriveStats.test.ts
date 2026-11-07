import { describe, expect, it } from 'vitest';

import { deriveProcessorStats } from './deriveStats';

function cleanValue(value: unknown) {
  if (value === null || value === undefined || value === '' || value === '-') {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
}

describe('deriveProcessorStats', () => {
  it('derives footedness and passing stats from raw values', () => {
    const player: Record<string, any> = {
      Mins: '180',
      basic_left_foot: '4',
      basic_right_foot: '2',
      statistic_passes_completed: '90',
      statistic_passes_attempted: '120'
    };

    deriveProcessorStats({
      cleanValue,
      defaultPossession: 50,
      getTeamPossession: () => null,
      player
    });

    expect(player.basic_preferred_foot).toBe('Lewa');
    expect(player['Preferred Foot']).toBe('Lewa');
    expect(player['Pas %']).toBe('75.0');
    expect(player['Pas A/90']).toBe('60.00');
  });

  it('calculates non-penalty xG derivatives from xG and penalties', () => {
    const player: Record<string, any> = {
      Mins: '90',
      xG: '1.50',
      Pens: '1',
      Gls: '2',
      'Pens S': '1'
    };

    deriveProcessorStats({
      cleanValue,
      defaultPossession: 50,
      getTeamPossession: () => null,
      player
    });

    expect(player['NP-xG/90']).toBe('0.74');
    expect(player['NP-Gls-NP-xG/90']).toBe('0.26');
  });

  it('uses team possession to derive PAdj stats and helper display fields', () => {
    const player: Record<string, any> = {
      Mins: '90',
      Club: 'Legia',
      'Tck A/90': '3.00',
      'Int/90': '2.00',
      'Clr/90': '4.00',
      'Blk/90': '1.50',
      'Pres A/90': '10.00'
    };

    deriveProcessorStats({
      cleanValue,
      defaultPossession: 50,
      getTeamPossession: (clubName) => (clubName === 'Legia' ? 60 : null),
      player
    });

    expect(player['PAdj Tck A']).toBe('3.75');
    expect(player['PAdj Int']).toBe('2.50');
    expect(player['PAdj Clr']).toBe('5.00');
    expect(player['PAdj Blk']).toBe('1.88');
    expect(player['PAdj Pres A']).toBe('12.50');
    expect(player['Team Poss']).toBe('60%');
  });
});
