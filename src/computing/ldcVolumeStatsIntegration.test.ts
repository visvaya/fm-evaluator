// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';

import { ldcSettings } from '../config/ldcConfig';
import { deriveProcessorStats } from '../data/deriveStats';

import { applyLDCToStats, computeLDC, restoreOriginalStats } from './ldc';

function cleanValue(value: unknown) {
  if (value === null || value === undefined || value === '' || value === '-') {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
}

describe('LDC volume-stat allowlist against the real scoring pipeline', () => {
  beforeEach(() => {
    ldcSettings.enabled = true;
    ldcSettings.model = 'simple';
    ldcSettings.alphaSimple = 5.3;
    ldcSettings.baseLeague = 'Premier League';
    ldcSettings.baseLeagueNation = '';
    ldcSettings.leagues = [
      {
        inputScore: 0,
        ldcRaw: 0,
        multiplier: 1,
        name: 'Premier League',
        nation: '',
        rank: 1,
        stars: null
      },
      {
        inputScore: 0,
        ldcRaw: 0,
        multiplier: 1,
        name: 'Weak League',
        nation: '',
        rank: 50,
        stars: null
      }
    ];
    computeLDC();
  });

  it('adjusts the Shot/90 alias exactly like Shots/90 through the real restore-derive-apply pipeline', () => {
    const player: Record<string, any> = {
      Club: 'Test FC',
      Division: 'Weak League',
      Mins: '900',
      'Shots/90': '4.00'
    };

    // Mirrors calculateScoresData: restore -> deriveStats -> applyLDCToStats.
    restoreOriginalStats(player);
    deriveProcessorStats({
      cleanValue,
      defaultPossession: 50,
      getTeamPossession: () => null,
      player
    });
    expect(player['Shot/90']).toBeDefined();
    expect(player['Shot/90']).toBe(player['Shots/90']);

    applyLDCToStats(player);

    expect(player['Shot/90']).toBe(player['Shots/90']);
    expect(Number(player['Shot/90'])).toBeLessThan(4); // raw Shots/90 was 4.00
  });

  it('adjusts Dist/90 and Sprints/90 for weak-league players', () => {
    const player: Record<string, any> = {
      Club: 'Test FC',
      'Dist/90': '11.20',
      Division: 'Weak League',
      'Sprints/90': '25.00'
    };

    applyLDCToStats(player);

    expect(Number(player['Dist/90'])).toBeLessThan(11.2);
    expect(Number(player['Sprints/90'])).toBeLessThan(25);
  });
});
