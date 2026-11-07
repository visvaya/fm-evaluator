import { describe, expect, it } from 'vitest';

import { defaultSettings, parseSettingsInput } from './settingsModel';

describe('defaultSettings', () => {
  it('has correct default values', () => {
    expect(defaultSettings).toEqual({
      adaptiveMinMins: null,
      defaultPossession: 50,
      ldcFilterEnabled: false,
      ldcFilterMax: 5,
      ldcFilterMin: 0,
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

  it('is a plain object (not frozen or shared reference)', () => {
    const copy = { ...defaultSettings, percentile: 80 };
    expect(copy.percentile).toBe(80);
    expect(defaultSettings.percentile).toBe(95);
  });
});

function validInput() {
  return {
    ldcFilterEnabled: false,
    ldcFilterMax: '5',
    ldcFilterMin: '0',
    maxBeeswarmPlayers: '500',
    minMins: '',
    normalizeAttr: true,
    normalizeStat: true,
    normalizeTotal: false,
    pAdjEnabled: true,
    penaltyXGFactor: '0.76',
    percentile: '95'
  };
}

describe('parseSettingsInput', () => {
  it('parses all numeric string fields to numbers', () => {
    const result = parseSettingsInput({
      ...validInput(),
      ldcFilterMax: '7',
      ldcFilterMin: '1',
      maxBeeswarmPlayers: '300',
      minMins: '450',
      penaltyXGFactor: '0.91',
      percentile: '88'
    });

    expect(result.ldcFilterMax).toBe(7);
    expect(result.ldcFilterMin).toBe(1);
    expect(result.maxBeeswarmPlayers).toBe(300);
    expect(result.minMins).toBe(450);
    expect(result.penaltyXGFactor).toBe(0.91);
    expect(result.percentile).toBe(88);
  });

  it('converts empty minMins string to null', () => {
    const result = parseSettingsInput({ ...validInput(), minMins: '' });
    expect(result.minMins).toBeNull();
  });

  it('parses boolean fields as-is', () => {
    const result = parseSettingsInput({
      ...validInput(),
      ldcFilterEnabled: true,
      normalizeAttr: false,
      normalizeStat: false,
      normalizeTotal: true,
      pAdjEnabled: false
    });

    expect(result.ldcFilterEnabled).toBe(true);
    expect(result.normalizeAttr).toBe(false);
    expect(result.normalizeStat).toBe(false);
    expect(result.normalizeTotal).toBe(true);
    expect(result.pAdjEnabled).toBe(false);
  });

  it('falls back to 5 for ldcFilterMax when parsed value is NaN', () => {
    const result = parseSettingsInput({ ...validInput(), ldcFilterMax: 'abc' });
    expect(result.ldcFilterMax).toBe(5);
  });

  it('falls back to 0 for ldcFilterMin when parsed value is NaN', () => {
    const result = parseSettingsInput({ ...validInput(), ldcFilterMin: 'abc' });
    expect(result.ldcFilterMin).toBe(0);
  });

  it('falls back to 500 for maxBeeswarmPlayers when parsed value is NaN or 0', () => {
    expect(
      parseSettingsInput({ ...validInput(), maxBeeswarmPlayers: 'abc' }).maxBeeswarmPlayers
    ).toBe(500);
    expect(
      parseSettingsInput({ ...validInput(), maxBeeswarmPlayers: '0' }).maxBeeswarmPlayers
    ).toBe(500);
  });

  it('preserves NaN for percentile and penaltyXGFactor on invalid input', () => {
    const result = parseSettingsInput({
      ...validInput(),
      penaltyXGFactor: 'bad',
      percentile: 'bad'
    });
    expect(Number.isNaN(result.percentile)).toBe(true);
    expect(Number.isNaN(result.penaltyXGFactor)).toBe(true);
  });

  it('does not include adaptiveMinMins or defaultPossession in output', () => {
    const result = parseSettingsInput(validInput());
    expect('adaptiveMinMins' in result).toBe(false);
    expect('defaultPossession' in result).toBe(false);
  });
});
