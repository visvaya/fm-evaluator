import { describe, expect, it } from 'vitest';

import { calculateScoresForAllRolesData } from './calculateScoresForAllRoles';

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

describe('calculateScoresForAllRolesData', () => {
  it('returns role scores per player and respects GK versus outfield role filtering', () => {
    const statDistributionCache = new Map();
    const mergedData = [
      {
        UID: 'st-1',
        Position: 'STC',
        Mins: '900',
        Acc: 14,
        Ant: 13,
        Cnt: 12,
        Cro: 8,
        Dri: 13,
        Fla: 12,
        Jum: 14,
        Pac: 15,
        'Aer A/90': '2.00',
        'CCC %': '12.00',
        'CCC/90': '0.30',
        'Ch C/90': '0.40',
        'Conv %': '15.00',
        'Dist/90': '10.00',
        'Drb/90': '0.60',
        'Duels Win %': '30.00',
        'Gls In Box %': '60.00',
        'Hdr %': '20.00',
        'Hdrs A/90': '2.50',
        'In Box Conv %': '20.00',
        'Int/90': '0.30',
        'K Ps/90': '0.50',
        'Net Fouls/90': '-0.10',
        'NP-Gls-NP-xG/90': '0.10',
        'NP-xG/90': '0.25',
        'NP-xG/Shot': '0.10',
        'OP-KP %': '5.00',
        'OP-KP/90': '0.50',
        'Pas %': '78.00',
        'Pas A/90': '18.00',
        'Poss+/-/90': '-5.00',
        'Poss Lost/90': '8.00',
        'Poss Won/90': '2.00',
        'Pres A/90': '4.00',
        'Pres C %': '18.00',
        'Pr Passes/90': '1.20',
        'Pr Pass Yield %': '4.50',
        'Shot/90': '1.40',
        'ShT %': '35.00',
        'ShT/90': '0.50',
        'Shts In %': '40.00',
        'Shts In/90': '0.70',
        'Shts Out/90': '0.30',
        'Sprints/90': '2.20',
        'Tck C/90': '0.10',
        'Tck R': '50.00'
      },
      {
        UID: 'gk-1',
        Position: 'GK',
        Mins: '900',
        Aer: 14,
        Agi: 15,
        Com: 13,
        Dec: 12,
        Fir: 10,
        Han: 14,
        Ref: 16,
        TRO: 11,
        'Pas %': '70.00',
        'Save Efficiency': '2.50',
        'Saves/90': '3.00',
        'Sv %': '75.00',
        'Svh/90': '1.50',
        'Svp/90': '0.80',
        'Svt/90': '0.70',
        'xGP/90': '0.20',
        'Tck Failed/90': '0.10',
        'Poss Lost/90': '6.00',
        'Poss Won/90': '1.50'
      }
    ];

    const result = calculateScoresForAllRolesData({
      cleanValue,
      engine: 'AsianFusion',
      mergedData,
      statDistributionCache,
      threshold: 180
    });

    expect(result.get('st-1')?.every((score) => score.role !== 'GK')).toBe(true);
    expect(result.get('gk-1')).toHaveLength(1);
    expect(result.get('gk-1')?.[0]?.role).toBe('GK');
    expect(result.get('st-1')?.some((score) => score.role === 'STC')).toBe(true);
    expect(result.get('st-1')?.[0]).toEqual(
      expect.objectContaining({
        attrScore: expect.any(Number),
        statScore: expect.any(Number),
        totalScore: expect.any(Number)
      })
    );
    expect(statDistributionCache.size).toBeGreaterThan(0);
  });

  it('reuses cached stat distributions on repeated calls', () => {
    const statDistributionCache = new Map();
    const mergedData = [
      {
        UID: 'st-1',
        Position: 'STC',
        Mins: '900',
        Acc: 14,
        Ant: 13,
        Cnt: 12,
        Cro: 8,
        Dri: 13,
        Fla: 12,
        Jum: 14,
        Pac: 15,
        'Aer A/90': '2.00',
        'CCC %': '12.00',
        'CCC/90': '0.30',
        'Ch C/90': '0.40',
        'Conv %': '15.00',
        'Dist/90': '10.00',
        'Drb/90': '0.60',
        'Duels Win %': '30.00',
        'Gls In Box %': '60.00',
        'Hdr %': '20.00',
        'Hdrs A/90': '2.50',
        'In Box Conv %': '20.00',
        'Int/90': '0.30',
        'K Ps/90': '0.50',
        'Net Fouls/90': '-0.10',
        'NP-Gls-NP-xG/90': '0.10',
        'NP-xG/90': '0.25',
        'NP-xG/Shot': '0.10',
        'OP-KP %': '5.00',
        'OP-KP/90': '0.50',
        'Pas %': '78.00',
        'Pas A/90': '18.00',
        'Poss+/-/90': '-5.00',
        'Poss Lost/90': '8.00',
        'Poss Won/90': '2.00',
        'Pres A/90': '4.00',
        'Pres C %': '18.00',
        'Pr Passes/90': '1.20',
        'Pr Pass Yield %': '4.50',
        'Shot/90': '1.40',
        'ShT %': '35.00',
        'ShT/90': '0.50',
        'Shts In %': '40.00',
        'Shts In/90': '0.70',
        'Shts Out/90': '0.30',
        'Sprints/90': '2.20',
        'Tck C/90': '0.10',
        'Tck R': '50.00'
      }
    ];

    calculateScoresForAllRolesData({
      cleanValue,
      engine: 'AsianFusion',
      mergedData,
      statDistributionCache,
      threshold: 180
    });
    const cachedKeys = [...statDistributionCache.keys()];

    calculateScoresForAllRolesData({
      cleanValue,
      engine: 'AsianFusion',
      mergedData,
      statDistributionCache,
      threshold: 180
    });

    expect([...statDistributionCache.keys()]).toEqual(cachedKeys);
  });
});
