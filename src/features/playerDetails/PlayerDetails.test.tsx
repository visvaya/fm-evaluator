// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlayerDetails as PlayerDetailsComponent } from './PlayerDetails';

const copyTextToClipboardMock = vi.fn();
const setSelectedPlayerIdMock = vi.fn();
const restoreFocusMock = vi.fn();
const identityUiText = (key: string) => key;

const player = {
  age: 21,
  attrDetails: [
    { isMissing: false, name: 'Acc', percentile: 79.8, score: 0.17, val: 12, weight: 0.0145 }
  ],
  attrScore: 17,
  club: 'Odiaxere',
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
};

const processorMock = {
  cleanValue: (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  },
  filterDistributionCache: new Map([
    [
      'STC',
      {
        'AER A/90': {
          max: 8,
          min: 1,
          values: [1.2, 3.4, 6.96]
        }
      }
    ]
  ]),
  mergedData: [
    {
      'AER A/90': 6.96,
      Acc: 12,
      Mins: 2147,
      'NP-xG/90': 0.23,
      Position: 'STC',
      UID: '65042525'
    },
    {
      'AER A/90': 2.1,
      Acc: 10,
      Mins: 1800,
      'NP-xG/90': 0.11,
      Position: 'STC',
      UID: '100'
    },
    {
      'AER A/90': 3.4,
      Acc: 11,
      Mins: 1700,
      'NP-xG/90': 0.14,
      Position: 'STC',
      UID: '101'
    },
    {
      'AER A/90': 4.2,
      Acc: 13,
      Mins: 1600,
      'NP-xG/90': 0.19,
      Position: 'STC',
      UID: '102'
    },
    {
      'AER A/90': 5.1,
      Acc: 14,
      Mins: 1500,
      'NP-xG/90': 0.2,
      Position: 'STC',
      UID: '103'
    }
  ]
};

const comparisonRuntime = {
  cleanValue: processorMock.cleanValue,
  filterDistributionCache: processorMock.filterDistributionCache,
  maxBeeswarmPlayers: 500,
  mergedData: processorMock.mergedData,
  minMins: 90
};

vi.mock('@/hooks/useUiText', () => ({
  useUiText: () => identityUiText
}));

vi.mock('@/lib/clipboard', () => ({
  copyTextToClipboard: copyTextToClipboardMock
}));

vi.mock('@/store/useTableStore', () => ({
  useTableStore: () => ({
    comparisonRuntime,
    currentPosition: 'STC',
    data: [player],
    selectedPlayerId: '65042525',
    setSelectedPlayerId: setSelectedPlayerIdMock
  })
}));

vi.mock('@/store/useWorkspaceStore', () => ({
  useWorkspaceStore: () => ({
    graphicsEnabled: true,
    restoreFocus: restoreFocusMock
  })
}));

vi.mock('@/data/dataProcessor', () => ({
  processor: processorMock
}));

// Importing the drawer transforms a large module graph (charts, stores); under machine load that took
// longer than the test timeout, so the import is warmed once with its own hook timeout.
const MODULE_IMPORT_TIMEOUT_MS = 60_000;

describe('PlayerDetails', () => {
  let container: HTMLDivElement;
  let root: Root;
  let PlayerDetails: typeof PlayerDetailsComponent;

  beforeAll(async () => {
    ({ PlayerDetails } = await import('./PlayerDetails'));
  }, MODULE_IMPORT_TIMEOUT_MS);

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    copyTextToClipboardMock.mockResolvedValue(true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders the React drawer and can open a comparison chart without legacy modal DOM', () => {
    act(() => {
      root.render(<PlayerDetails />);
    });

    const comparisonButtons = [...container.querySelectorAll('button')].filter((button) =>
      button.textContent?.includes('show_comparison')
    );

    expect(container.querySelector('[data-testid="player-details-drawer"]')).not.toBeNull();
    expect(comparisonButtons.length).toBeGreaterThan(0);

    act(() => {
      comparisonButtons[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const chart = container.querySelector('[data-testid="player-beeswarm-chart"]');

    expect(chart).not.toBeNull();
    expect(chart?.textContent).toContain('6.96');
    expect(chart?.textContent).toContain('2.1');
  }, 15000);
});
