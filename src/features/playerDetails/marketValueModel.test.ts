// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { getBestRoleSummary, getRatioCards } from './marketValueModel';

describe('marketValueModel', () => {
  it('maps ratio cards with tone and badge metadata', () => {
    const cards = getRatioCards({
      scorePerValue: 1.62,
      scorePerValueAtr: 0.71,
      scorePerValueStat: null,
      scorePerWage: 0.74,
      scorePerWageAtr: 1.21,
      scorePerWageStat: 0.95,
      valueRating: 'niedoceniony',
      wageRating: 'overrated'
    } as never);

    expect(cards[0]).toMatchObject({
      badgeText: '↓ Niedoceniony',
      tone: 'positive',
      value: '1.62x'
    });
    expect(cards[1]).toMatchObject({
      badgeText: '↑ Przeceniony',
      tone: 'negative',
      value: '0.74x'
    });
    expect(cards[2]).toMatchObject({ badgeText: null, tone: 'warning', value: 'N/A' });
    expect(cards[4]).toMatchObject({ tone: 'negative', value: '0.71x' });
    expect(cards[5]).toMatchObject({ tone: 'positive', value: '1.21x' });
  });

  it('deduplicates translated best roles', () => {
    const summary = getBestRoleSummary({
      bestRole: {
        attrRole: 'AMLR',
        role: 'MLR',
        statRole: 'AMLR',
        totalRole: 'MLR'
      }
    } as never);

    expect(summary.length).toBeGreaterThan(0);
    expect(new Set(summary).size).toBe(summary.length);
  });
});
