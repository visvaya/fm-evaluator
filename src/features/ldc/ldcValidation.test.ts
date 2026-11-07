import { describe, expect, it } from 'vitest';

import { parseLdcSettingsPayload } from './ldcValidation';

describe('parseLdcSettingsPayload', () => {
  it('accepts a valid exported settings payload', () => {
    const result = parseLdcSettingsPayload({
      alphaBasket: 1.7,
      alphaSimple: 5.3,
      baseLeague: 'Premier League',
      enabled: true,
      leagues: [
        {
          inputScore: 100,
          ldcRaw: 1,
          multiplier: 1,
          name: 'Premier League',
          nation: 'Anglia',
          rank: 1,
          stars: 5
        }
      ],
      mappings: {},
      model: 'basket'
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid model, alpha and star values atomically', () => {
    const result = parseLdcSettingsPayload({
      alphaBasket: Number.POSITIVE_INFINITY,
      alphaSimple: 5.3,
      baseLeague: 'Premier League',
      enabled: true,
      leagues: [
        {
          inputScore: 100,
          ldcRaw: 1,
          multiplier: 1,
          name: 'Broken',
          nation: 'Test',
          rank: 1,
          stars: 0
        }
      ],
      model: 'unknown'
    });

    expect(result.success).toBe(false);
  });
});
