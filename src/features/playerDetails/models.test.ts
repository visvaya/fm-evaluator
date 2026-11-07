// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { getPlayerDetailsModel } from './models';

describe('getPlayerDetailsModel', () => {
  it('maps legacy player data into a rich React details model', () => {
    const model = getPlayerDetailsModel({
      age: 21,
      attrDetails: [
        { isMissing: false, name: 'Acc', percentile: 79.8, score: 0.17, val: 12, weight: 0.0145 }
      ],
      attrScore: 17,
      bestRole: {
        attrRole: 'AMLR',
        role: 'MLR',
        statRole: 'AMLR',
        totalRole: 'MLR'
      },
      club: 'Odiáxere',
      filters: [{ limit: 'min: 2.54', name: 'AER A/90', passed: true, val: '6.96' }],
      foot: 'Prawa',
      league: 'AF Algarve 1ª Divisão',
      leftFootValue: 1,
      mins: 2147,
      name: 'Sanele Zwane',
      pos2Array: ['OP (P)'],
      position: 'P (P)',
      positionArray: ['P (P)', 'OP (P)'],
      rightFootValue: 5,
      scorePerValue: 1.62,
      scorePerWage: 0.74,
      statDetails: [
        {
          isLow: false,
          missing: false,
          name: 'NP-xG/90',
          percentile: 93.1,
          score: 17,
          val: 0.23,
          weight: 1.85
        }
      ],
      statScore: 15.5,
      suggestion: 'KUP',
      totalScore: 16.2,
      uid: '65042525',
      value: 0,
      wage: 'N/D'
    });

    expect(model.name).toBe('Sanele Zwane');
    expect(model.uid).toBe('65042525');
    expect(model.roleRequirements).toHaveLength(1);
    expect(model.roleRequirements[0]).toMatchObject({
      chartValue: 6.96,
      label: 'AER A/90',
      passed: true,
      sourceKey: 'AER A/90',
      value: '6.96'
    });
    expect(model.attrRows[0]).toMatchObject({
      chartValue: 12,
      label: 'Acc',
      rawValue: '12.00',
      sourceKey: 'Acc'
    });
    expect(model.statRows[0]).toMatchObject({
      chartValue: 0.23,
      label: 'NP-xG/90',
      rawValue: '0.23',
      sourceKey: 'NP-xG/90'
    });
    expect(model.ratioCards[0]).toMatchObject({ label: 'xVal Ratio', value: '1.62x' });
  });

  it('surfaces warnings for missing attributes and low-minutes stat profiles', () => {
    const model = getPlayerDetailsModel({
      age: 18,
      attrDetails: [{ isMissing: true, name: 'Bal', score: null, val: null, weight: 0.01 }],
      attrScore: 8,
      club: 'Test Club',
      filters: [],
      isLow: true,
      league: 'Test League',
      mins: 120,
      name: 'Project Player',
      statDetails: [
        { isLow: true, missing: true, name: 'NP-xG/90', score: null, val: '-', weight: 1.1 }
      ],
      statScore: 0,
      suggestion: 'ŚLEDŹ',
      totalScore: 8,
      uid: 'p-001'
    });

    expect(model.attrWarnings.length).toBeGreaterThan(0);
    expect(model.statWarnings.length).toBeGreaterThan(0);
    expect(model.ratioCards[0].value).toBe('N/A');
    expect(model.attrRows[0].chartValue).toBeNull();
  });
});
