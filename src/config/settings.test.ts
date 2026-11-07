import { describe, expect, it } from 'vitest';

import { defaultSettings, parseSettingsInput, type AppSettings } from './settings';

describe('config/settings barrel', () => {
  it('re-exports defaultSettings from settingsModel', () => {
    expect(defaultSettings).toMatchObject({
      adaptiveMinMins: null,
      ldcFilterEnabled: false,
      maxBeeswarmPlayers: 500,
      minMins: null,
      normalizeAttr: true,
      normalizeStat: true,
      normalizeTotal: false,
      pAdjEnabled: true,
      penaltyXGFactor: 0.76,
      percentile: 95
    });
  });

  it('re-exports parseSettingsInput from settingsModel', () => {
    const result: Partial<AppSettings> = parseSettingsInput({
      ldcFilterEnabled: true,
      ldcFilterMax: '7',
      ldcFilterMin: '1',
      maxBeeswarmPlayers: '300',
      minMins: '450',
      normalizeAttr: false,
      normalizeStat: true,
      normalizeTotal: false,
      pAdjEnabled: false,
      penaltyXGFactor: '0.8',
      percentile: '90'
    });

    expect(result.percentile).toBe(90);
    expect(result.minMins).toBe(450);
    expect(result.pAdjEnabled).toBe(false);
  });
});
