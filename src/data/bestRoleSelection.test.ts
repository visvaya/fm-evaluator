import { describe, expect, it } from 'vitest';

import {
  buildPlayerBestRoleDetails,
  inferMostCommonPrimaryRole,
  normalizeRoleScoresMap
} from './bestRoleSelection';

describe('bestRoleSelection', () => {
  it('normalizes each role independently so the best player per role reaches 20', () => {
    const roleScoresMap = new Map([
      [
        'player-1',
        [
          { attrScore: 6, role: 'DC', statScore: 2, totalScore: 10 },
          { attrScore: 4, role: 'DM', statScore: 1, totalScore: 8 }
        ]
      ],
      [
        'player-2',
        [
          { attrScore: 10, role: 'DC', statScore: 6, totalScore: 30 },
          { attrScore: 8, role: 'DM', statScore: 5, totalScore: 20 }
        ]
      ]
    ]);

    normalizeRoleScoresMap({
      normalizeAttr: true,
      normalizeStat: true,
      normalizeTotal: true,
      roleScoresMap
    });

    // DC role: player-2 is best → 20; player-1 scales within DC bounds
    expect(roleScoresMap.get('player-2')?.[0]).toEqual({
      attrScore: 20,
      role: 'DC',
      statScore: 20,
      totalScore: 20
    });
    expect(roleScoresMap.get('player-1')?.[0]).toEqual({
      attrScore: 0,
      role: 'DC',
      statScore: 0,
      totalScore: 0
    });

    // DM role: player-2 is best → 20; player-1 scales within DM bounds (independent of DC)
    expect(roleScoresMap.get('player-2')?.[1]).toEqual({
      attrScore: 20,
      role: 'DM',
      statScore: 20,
      totalScore: 20
    });
    expect(roleScoresMap.get('player-1')?.[1]).toEqual({
      attrScore: 0,
      role: 'DM',
      statScore: 0,
      totalScore: 0
    });
  });

  it('recomputes total score from normalized stat and attr scores when total normalization is disabled', () => {
    const roleScoresMap = new Map([
      ['player-1', [{ attrScore: 10, role: 'DC', statScore: 0, totalScore: 50 }]],
      ['player-2', [{ attrScore: 20, role: 'DC', statScore: 20, totalScore: 70 }]]
    ]);

    normalizeRoleScoresMap({
      normalizeAttr: true,
      normalizeStat: true,
      normalizeTotal: false,
      roleScoresMap
    });

    // player-2 is best in DC → gets 20/20, total = avg(20, 20) = 20
    expect(roleScoresMap.get('player-2')?.[0]).toEqual({
      attrScore: 20,
      role: 'DC',
      statScore: 20,
      totalScore: 20
    });
    // player-1: attr=(10-10)/(20-10)*20=0, stat=(0-0)/(20-0)*20=0, total=avg(0,0)=0
    expect(roleScoresMap.get('player-1')?.[0]).toEqual({
      attrScore: 0,
      role: 'DC',
      statScore: 0,
      totalScore: 0
    });
  });

  it('builds best-role details with tied roles and infers the dominant primary role', () => {
    const playerBestRoles = buildPlayerBestRoleDetails(
      new Map([
        [
          'player-1',
          [
            { attrScore: 9, role: 'MC', statScore: 7, totalScore: 8 },
            { attrScore: 8, role: 'DC', statScore: 9, totalScore: 10 },
            { attrScore: 7, role: 'DM', statScore: 9, totalScore: 10 }
          ]
        ],
        [
          'player-2',
          [
            { attrScore: 6, role: 'DC', statScore: 8, totalScore: 11 },
            { attrScore: 5, role: 'DM', statScore: 6, totalScore: 7 }
          ]
        ]
      ])
    );

    expect(playerBestRoles.get('player-1')).toEqual({
      attrRole: 'MC',
      attrScore: 9,
      role: 'DC/DM',
      statRole: 'DC/DM',
      statScore: 9,
      totalRole: 'DC/DM',
      totalScore: 10
    });
    expect(playerBestRoles.get('player-2')).toEqual({
      attrRole: 'DC',
      attrScore: 6,
      role: 'DC',
      statRole: 'DC',
      statScore: 8,
      totalRole: 'DC',
      totalScore: 11
    });
    expect(inferMostCommonPrimaryRole(playerBestRoles)).toBe('DC');
  });
});
