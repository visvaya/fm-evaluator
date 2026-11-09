import { describe, expect, it } from 'vitest';

import { createCleanValue } from './cleanValue';
import { mergeProcessorData } from './mergeData';

const plainNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const mergeAttributeRows = (attributes: Record<string, unknown>[]): unknown[] =>
  mergeProcessorData(
    {
      attributes,
      cleanValue: plainNumber,
      fileStack: [],
      parseFeet: () => ({ left: 3, right: 4 }),
      parsePositions: (position) => [position].filter(Boolean),
      stats: []
    },
    true
  );

describe('mergeProcessorData money range bounds', () => {
  const single = { UID: '7', basic_transfer_value: 1600 };
  const ranged = {
    UID: '7',
    basic_transfer_value: 22_000,
    basic_transfer_value_high: 35_000,
    basic_transfer_value_low: 9000
  };

  it('drops the bounds of a range when the value comes from another export', () => {
    const [merged] = mergeAttributeRows([single, ranged]);
    expect(merged).toMatchObject({ basic_transfer_value: 1600 });
    expect(merged).not.toHaveProperty('basic_transfer_value_low');
    expect(merged).not.toHaveProperty('basic_transfer_value_high');
  });

  it('keeps the bounds of a value that only a statistics export supplies', () => {
    const [merged] = mergeProcessorData(
      {
        attributes: [],
        cleanValue: plainNumber,
        fileStack: [],
        parseFeet: () => ({ left: 3, right: 4 }),
        parsePositions: (position) => [position].filter(Boolean),
        stats: [{ ...ranged, Mins: '900' }]
      },
      true
    ) as unknown[];
    expect(merged).toMatchObject({
      basic_transfer_value_high: 35_000,
      basic_transfer_value_low: 9000
    });
  });

  it('drops the bounds when a single value equals the midpoint of a later range', () => {
    const [merged] = mergeAttributeRows([{ UID: '7', basic_transfer_value: 22_000 }, ranged]);
    expect(merged).not.toHaveProperty('basic_transfer_value_low');
  });

  const statRow = (value: number) => ({
    ...ranged,
    Mins: '900',
    basic_transfer_value: value,
    basic_transfer_value_high: value + 1000,
    basic_transfer_value_low: value - 1000
  });

  it('drops the bounds of a value averaged over several statistics rows', () => {
    const [merged] = mergeProcessorData(
      {
        attributes: [],
        cleanValue: plainNumber,
        fileStack: [],
        parseFeet: () => ({ left: 3, right: 4 }),
        parsePositions: (position) => [position].filter(Boolean),
        stats: [statRow(10_000), statRow(20_000), statRow(30_000)]
      },
      true
    ) as unknown[];
    expect(merged).not.toHaveProperty('basic_transfer_value_low');
  });

  it('drops statistics bounds when a normal merge takes the attribute value', () => {
    const [merged] = mergeProcessorData(
      {
        attributes: [single],
        cleanValue: plainNumber,
        fileStack: [],
        parseFeet: () => ({ left: 3, right: 4 }),
        parsePositions: (position) => [position].filter(Boolean),
        stats: [ranged]
      },
      false
    ) as unknown[];
    expect(merged).toMatchObject({ basic_transfer_value: 1600 });
    expect(merged).not.toHaveProperty('basic_transfer_value_low');
  });

  it('keeps the bounds of the export the value comes from', () => {
    const [merged] = mergeAttributeRows([ranged, single]);
    expect(merged).toMatchObject(ranged);
  });
});

describe('mergeProcessorData', () => {
  it('aggregates merge-mode raw stats before deriving per-90 values', () => {
    const merged = mergeProcessorData(
      {
        attributes: [{ UID: '7', Name: 'Jan', Position: 'ST', 'Sec. Position': '' }],
        cleanValue: (value) => {
          if (value === null || value === undefined || value === '') {
            return null;
          }
          const parsed = Number(value);
          return Number.isNaN(parsed) ? null : parsed;
        },
        fileStack: [],
        parseFeet: () => ({ left: 3, right: 4 }),
        parsePositions: (position) => [position].filter(Boolean),
        stats: [
          {
            UID: '7',
            Mins: '90',
            Gls: '1',
            'Gls/90': '1.00',
            'Pas %': '80',
            'Ps C': '20',
            'Pas A': '25'
          },
          {
            UID: '7',
            Mins: '180',
            Gls: '2',
            'Gls/90': '1.00',
            'Pas %': '50',
            'Ps C': '15',
            'Pas A': '30'
          }
        ]
      },
      true
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(
      expect.objectContaining({
        UID: '7',
        Gls: 3,
        'Gls/90': '1.00',
        'Pas %': '63.6',
        leftFootValue: 3,
        rightFootValue: 4
      })
    );
  });

  it('sums Ast (not the non-existent "As") across merged files', () => {
    const merged = mergeProcessorData(
      {
        attributes: [{ UID: '9', Name: 'Kasia', Position: 'AMC', 'Sec. Position': '' }],
        cleanValue: (value) => {
          if (value === null || value === undefined || value === '') return null;
          const parsed = Number(value);
          return Number.isNaN(parsed) ? null : parsed;
        },
        fileStack: [],
        parseFeet: () => ({ left: 3, right: 4 }),
        parsePositions: (position) => [position].filter(Boolean),
        stats: [
          { UID: '9', Ast: '2', Mins: '90' },
          { UID: '9', Ast: '3', Mins: '90' }
        ]
      },
      true
    );

    expect(merged[0]).toEqual(expect.objectContaining({ Ast: 5 }));
  });

  it('divides OP-KP % by Pas A, matching the single-file derivation formula', () => {
    const merged = mergeProcessorData(
      {
        attributes: [{ UID: '11', Name: 'Piotr', Position: 'MC', 'Sec. Position': '' }],
        cleanValue: (value) => {
          if (value === null || value === undefined || value === '') return null;
          const parsed = Number(value);
          return Number.isNaN(parsed) ? null : parsed;
        },
        fileStack: [],
        parseFeet: () => ({ left: 3, right: 4 }),
        parsePositions: (position) => [position].filter(Boolean),
        stats: [
          { 'OP-KP %': '10', 'OP-KP': '10', 'Pas A': '20', UID: '11' },
          { 'OP-KP %': '10', 'OP-KP': '10', 'Pas A': '20', UID: '11' }
        ]
      },
      true
    );

    // OP-KP summed = 20, Pas A summed = 40 -> 20/40*100 = 50.0
    expect(merged[0]).toEqual(expect.objectContaining({ 'OP-KP %': '50.0' }));
  });

  it('sums a stat column that only appears in the second file, not the first', () => {
    const merged = mergeProcessorData(
      {
        attributes: [{ UID: '17', Name: 'Marek', Position: 'DC', 'Sec. Position': '' }],
        cleanValue: (value) => {
          if (value === null || value === undefined || value === '') return null;
          const parsed = Number(value);
          return Number.isNaN(parsed) ? null : parsed;
        },
        fileStack: [],
        parseFeet: () => ({ left: 3, right: 4 }),
        parsePositions: (position) => [position].filter(Boolean),
        stats: [
          // First file lacks 'Itc' entirely - it only shows up in file two.
          { UID: '17', Mins: '90', Gls: '1' },
          { UID: '17', Mins: '90', Gls: '1', Itc: '5' }
        ]
      },
      true
    );

    // Previously the schema was read only from statList[0], so any column
    // absent from the first file (but present in a later one) was dropped
    // entirely, silently losing data the merge should have summed.
    expect(merged[0]).toEqual(expect.objectContaining({ Itc: 5 }));
  });

  it('keeps Division/Based In as text with the real cleanValue (regression: false "numeric" detection)', () => {
    // The real cleanValue (src/data/cleanValue.ts) returns the original
    // string for unparseable text instead of null, so a plain
    // `value !== null && !Number.isNaN(value)` check misclassifies any
    // string as numeric (Number.isNaN('Premier League') is false, since
    // Number.isNaN only ever returns true for the literal NaN value) and
    // corrupts it into the string "NaN" via `value * mins`.
    const merged = mergeProcessorData(
      {
        attributes: [{ UID: '23', Name: 'Kuba', Position: 'MC', 'Sec. Position': '' }],
        cleanValue: createCleanValue(new Map()),
        fileStack: [],
        parseFeet: () => ({ left: 3, right: 4 }),
        parsePositions: (position) => [position].filter(Boolean),
        stats: [
          { UID: '23', Division: 'Premier League', Mins: '90', 'Based In': 'ENG' },
          { UID: '23', Division: 'Premier League', Mins: '90', 'Based In': 'ENG' }
        ]
      },
      true
    );

    expect(merged[0]).toEqual(
      expect.objectContaining({ 'Based In': 'ENG', Division: 'Premier League' })
    );
  });

  it('averages a numeric stat across rows even when the first row is blank, with the real cleanValue', () => {
    // Aggregation used to be decided from statList[0] alone: a blank first
    // value (cleanValue('') === null) made the key look non-numeric, so the
    // two real values that followed were never averaged - only the raw
    // last value was kept.
    const merged = mergeProcessorData(
      {
        attributes: [{ UID: '25', Name: 'Wojtek', Position: 'GK', 'Sec. Position': '' }],
        cleanValue: createCleanValue(new Map()),
        fileStack: [],
        parseFeet: () => ({ left: 3, right: 4 }),
        parsePositions: (position) => [position].filter(Boolean),
        stats: [
          { UID: '25', Mins: '90', 'Sv %': '' },
          { UID: '25', Mins: '90', 'Sv %': '80' },
          { UID: '25', Mins: '90', 'Sv %': '60' }
        ]
      },
      true
    );

    // Minutes-weighted average of the two real values: (80*90 + 60*90) / 180 = 70.00
    expect(merged[0]['Sv %']).toBe('70.00');
  });

  it('does not let a "-"/"N/A" placeholder attribute value shadow a real value in a later row', () => {
    // cleanValue.ts's MISSING_SYMBOLS set treats '-', 'N/A', 'Unknown',
    // 'Nieznana' etc. as absent, not just ''. hasMeaningfulValue must go
    // through cleanValue(value) !== null, not a plain trim()-empty check,
    // or these placeholders keep shadowing a real value from a later file.
    const merged = mergeProcessorData(
      {
        attributes: [
          {
            UID: '29',
            Division: '-',
            Name: 'Bartek',
            Position: 'MC',
            'Sec. Position': '',
            'Based In': 'N/A'
          },
          { UID: '29', 'Based In': 'ITA', Division: 'Serie A' }
        ],
        cleanValue: createCleanValue(new Map()),
        fileStack: [],
        parseFeet: () => ({ left: 3, right: 4 }),
        parsePositions: (position) => [position].filter(Boolean),
        stats: [{ UID: '29', Mins: '90' }]
      },
      true
    );

    expect(merged[0]).toEqual(expect.objectContaining({ 'Based In': 'ITA', Division: 'Serie A' }));
  });

  it('does not let a blank first attribute value shadow a real value in a later row', () => {
    const merged = mergeProcessorData(
      {
        attributes: [
          // First file has the Division key but blank (e.g. general info
          // export without club data yet); second file has the real value.
          { UID: '27', Division: '', Name: 'Adam', Position: 'DC', 'Sec. Position': '' },
          { UID: '27', Division: 'Serie A' }
        ],
        cleanValue: createCleanValue(new Map()),
        fileStack: [],
        parseFeet: () => ({ left: 3, right: 4 }),
        parsePositions: (position) => [position].filter(Boolean),
        stats: [{ UID: '27', Mins: '90' }]
      },
      true
    );

    expect(merged[0].Division).toBe('Serie A');
  });

  it('picks up an attribute column (e.g. Division) that only appears in the second attribute file', () => {
    const merged = mergeProcessorData(
      {
        attributes: [
          { UID: '19', Name: 'Ewa', Position: 'MC', 'Sec. Position': '' },
          { UID: '19', Division: 'Premier League', 'Based In': 'ENG' }
        ],
        cleanValue: (value) => {
          if (value === null || value === undefined || value === '') return null;
          const parsed = Number(value);
          return Number.isNaN(parsed) ? null : parsed;
        },
        fileStack: [],
        parseFeet: () => ({ left: 3, right: 4 }),
        parsePositions: (position) => [position].filter(Boolean),
        stats: [{ UID: '19', Mins: '90' }]
      },
      true
    );

    // Previously only the first attribute row's keys were copied onto the
    // merged player, so Division/Based In arriving in a later attribute
    // file were silently lost - LDC would then fall back to the neutral
    // 1.000 multiplier for that player without any indication why.
    expect(merged[0]).toEqual(
      expect.objectContaining({ 'Based In': 'ENG', Division: 'Premier League' })
    );
  });

  it('does not let a row missing a stat drag its weighted average toward zero', () => {
    const merged = mergeProcessorData(
      {
        attributes: [{ UID: '21', Name: 'Tomek', Position: 'GK', 'Sec. Position': '' }],
        cleanValue: (value) => {
          if (value === null || value === undefined || value === '') return null;
          const parsed = Number(value);
          return Number.isNaN(parsed) ? null : parsed;
        },
        fileStack: [],
        parseFeet: () => ({ left: 3, right: 4 }),
        parsePositions: (position) => [position].filter(Boolean),
        stats: [
          // 'Sv %' only present in the second row. Previously totalMins
          // (180) was used as the denominator for both rows, treating the
          // first row's missing value as 0 and halving the true average.
          { UID: '21', Mins: '90' },
          { UID: '21', Mins: '90', 'Sv %': '80' }
        ]
      },
      true
    );

    // Weighted average over only the row that actually has 'Sv %': 80.
    expect(merged[0]['Sv %']).toBe('80.00');
  });

  it('minute-weights Poss Won/90 instead of dropping it (no raw season total exists)', () => {
    const merged = mergeProcessorData(
      {
        attributes: [{ UID: '13', Name: 'Ola', Position: 'DC', 'Sec. Position': '' }],
        cleanValue: (value) => {
          if (value === null || value === undefined || value === '') return null;
          const parsed = Number(value);
          return Number.isNaN(parsed) ? null : parsed;
        },
        fileStack: [],
        parseFeet: () => ({ left: 3, right: 4 }),
        parsePositions: (position) => [position].filter(Boolean),
        stats: [
          { Mins: '90', 'Poss Won/90': '4.00', UID: '13' },
          { Mins: '90', 'Poss Won/90': '6.00', UID: '13' }
        ]
      },
      true
    );

    // No raw "Poss Won" source exists, so this falls to the generic
    // minutes-weighted-average path: (4*90 + 6*90) / 180 = 5.00.
    expect(merged[0]['Poss Won/90']).toBe('5.00');
  });
});
