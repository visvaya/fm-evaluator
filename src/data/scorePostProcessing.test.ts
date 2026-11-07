import { describe, expect, it } from 'vitest';

import {
  applyBestRoleViewScores,
  applySelectedRoleBestScores,
  buildCalculatedScoreEntry,
  buildFilterResults
} from './scorePostProcessing';

describe('scorePostProcessing', () => {
  it('builds filter results and marks skipped stats as failed visually', () => {
    const result = buildFilterResults({
      cleanValue: (value) => value,
      filters: {
        Agg: 10,
        Pace: { max: 15 }
      },
      player: {
        Agg: 11,
        Pace: 12,
        statDetails: [{ name: 'Pace', skipped: true }],
        uid: 'player-1'
      }
    });

    expect(result.passesFilters).toBe(true);
    expect(result.filterResults).toEqual([
      { limit: 'min 10', name: 'Agg', passed: true, skipped: false, val: '11.00' },
      { limit: 'max 15', name: 'Pace', passed: false, skipped: true, val: '-' }
    ]);
  });

  it('ignores skipped failures for best-role filters when requested', () => {
    const calculatedScores = [
      {
        Agg: 8,
        Pace: 10,
        statDetails: [{ name: 'Agg', skipped: true }],
        uid: 'player-1'
      }
    ];

    applyBestRoleViewScores({
      calculatedScores,
      cleanValue: (value) => value,
      playerBestRoles: new Map([
        [
          'player-1',
          {
            attrRole: 'DC',
            attrScore: 14,
            role: 'DC',
            statRole: 'DC',
            statScore: 16,
            totalRole: 'DC',
            totalScore: 15
          }
        ]
      ]),
      positionFilters: {
        DC: {
          Agg: 10,
          Pace: { max: 11 }
        }
      }
    });

    expect(calculatedScores[0]).toMatchObject({
      attrScore: 14,
      passesFilters: true,
      statScore: 16,
      totalScore: 15
    });
    expect((calculatedScores[0] as any).filters).toEqual([
      { limit: 'min 10', name: 'Agg', passed: false, skipped: true, val: '-' },
      { limit: 'max 11', name: 'Pace', passed: true, skipped: false, val: '10.00' }
    ]);
  });

  it('applies best-role metadata and selected-role normalized scores in specific-role view', () => {
    const calculatedScores = [
      {
        attrScore: 1,
        statScore: 2,
        totalScore: 3,
        uid: 'player-1'
      }
    ];

    applySelectedRoleBestScores({
      actualPosition: 'DM',
      allPlayerBestRoles: new Map([
        [
          'player-1',
          {
            attrRole: 'DC',
            attrScore: 18,
            role: 'DM',
            statRole: 'DM',
            statScore: 19,
            totalRole: 'DM',
            totalScore: 17
          }
        ]
      ]),
      allScores: new Map([
        [
          'player-1',
          [
            { attrScore: 18, role: 'DC', statScore: 12, totalScore: 15 },
            { attrScore: 16, role: 'DM', statScore: 14, totalScore: 13 }
          ]
        ]
      ]),
      calculatedScores
    });

    expect(calculatedScores[0]).toMatchObject({
      attrScore: 16,
      bestRoleAttr: { role: 'DC', score: 18 },
      bestRoleStat: { role: 'DM', score: 19 },
      bestRoleTotal: { role: 'DM', score: 17 },
      statScore: 14,
      totalScore: 13
    });
  });

  it('builds the final calculated score entry with flags, category and display fallbacks', () => {
    const entry = buildCalculatedScoreEntry({
      attrDetails: [{ name: 'Agg', val: 12 }],
      attrScore: 13,
      cleanValue: (value) => value,
      club: 'Legia',
      coeffKeys: ['Agg', 'Pace', 'Work Rate'],
      filters: {
        Agg: 10
      },
      isLow: false,
      league: 'Ekstraklasa',
      mins: 900,
      missingAttrCount: 1,
      missingStatCount: 1,
      name: 'Jan Kowalski',
      player: {
        Age: 22,
        Club: 'Legia',
        Name: 'Jan Kowalski',
        Position: 'DM',
        UID: 'player-1',
        uid: 'player-1',
        Wage: '10K p/w',
        basic_preferred_foot: 'Right',
        basic_transfer_value_display: '€5M',
        pos2Array: ['MC'],
        positionArray: ['DM'],
        statDetails: []
      },
      playerPosition: 'DM',
      rangeAttrCount: 0,
      rangeStatCount: 1,
      statDetails: [{ name: 'Agg', skipped: false }],
      statScore: 15,
      totalAttrWeight: 3,
      totalStatWeight: 4
    });

    expect(entry).toMatchObject({
      age: 22,
      attrScore: 13,
      club: 'Legia',
      dataCategory: 'Brak/niepełne statystyki',
      foot: 'Right',
      hasAnyRange: true,
      hasManyMissing: true,
      hasMissingAttrs: true,
      hasMissingStats: true,
      hasRangeAttrs: false,
      hasRangeStats: true,
      isLow: false,
      league: 'Ekstraklasa',
      mins: 900,
      name: 'Jan Kowalski',
      passesFilters: false,
      position: 'DM',
      shouldItalicizeAttrScore: true,
      shouldItalicizeStatScore: true,
      statScore: 15,
      totalScore: 14,
      uid: 'player-1',
      value: '€5M',
      wage: '10K p/w'
    });
    expect(entry.filters).toEqual([
      { limit: 'min 10', name: 'Agg', passed: false, skipped: false, val: '0.00' }
    ]);
  });
});
