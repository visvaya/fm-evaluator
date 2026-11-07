// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/ui/ldcMissing', () => ({
  addLeagueWithValues: vi.fn(),
  checkMissingLeagues: vi.fn(),
  detectMissingLeagues: vi.fn(() => [])
}));

import { useLdcMissingStore } from '@/features/ldc/useLdcMissingStore';
import { checkMissingLeagues, detectMissingLeagues } from '@/ui/ldcMissing';

import { LdcMissingPanel, LdcMissingPanelTrigger } from './LdcMissingPanel';

const sampleState = {
  groups: [
    {
      country: 'Polska',
      displayName: 'Polska',
      key: 'country-Polska',
      leagues: [
        {
          countryCode: 'POL',
          matchScore: null,
          matchType: 'none',
          name: 'Liga A',
          nation: 'Polska',
          normalized: 'Liga A',
          suggestedMatch: null,
          suggestedRank: 1,
          suggestedStars: 2.5
        }
      ],
      subGroups: [
        {
          country: 'Polska',
          displayName: 'Inne',
          key: 'other|Polska',
          leagues: [
            {
              countryCode: 'POL',
              matchScore: null,
              matchType: 'none',
              name: 'Liga A',
              nation: 'Polska',
              normalized: 'Liga A',
              suggestedMatch: null,
              suggestedRank: 1,
              suggestedStars: 2.5
            }
          ],
          normalizedName: null
        }
      ]
    }
  ],
  missingLeagues: [
    {
      countryCode: 'POL',
      matchScore: null,
      matchType: 'none',
      name: 'Liga A',
      nation: 'Polska',
      normalized: 'Liga A',
      suggestedMatch: null,
      suggestedRank: 1,
      suggestedStars: 2.5
    }
  ]
};

describe('LdcMissingPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    Element.prototype.scrollIntoView = vi.fn();
    useLdcMissingStore.setState({
      groups: sampleState.groups,
      hasCheckedMissingLeagues: false,
      isPanelVisible: false,
      isRechecking: false,
      missingLeagues: sampleState.missingLeagues,
      recheckSummary: null,
      selectedLeagueNames: []
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('shows the panel from the CTA and updates selection count', () => {
    act(() => {
      root.render(
        <>
          <LdcMissingPanelTrigger />
          <LdcMissingPanel />
        </>
      );
    });

    const showButton = container.querySelector<HTMLButtonElement>('#ldc-show-missing-btn');
    expect(showButton?.textContent).toContain('Brakujące ligi');

    act(() => {
      showButton?.click();
    });

    expect(checkMissingLeagues).toHaveBeenCalledTimes(1);
    expect(useLdcMissingStore.getState().isPanelVisible).toBe(true);

    const countryToggle = container.querySelector<HTMLInputElement>('.ldc-country-checkbox');
    act(() => {
      countryToggle?.click();
    });

    expect(container.querySelector('#ldc-selected-count')?.textContent).toContain('1 zaznaczonych');
    expect(container.querySelector('#ldc-add-selected-btn')?.className.includes('hidden')).toBe(
      false
    );
  });

  it('expands country and subgroup sections when clicking their text buttons', () => {
    useLdcMissingStore.setState({
      groups: [
        {
          country: 'Portugalia',
          displayName: 'Portugalia',
          key: 'country-Portugalia',
          leagues: [
            {
              countryCode: 'POR',
              matchScore: null,
              matchType: 'normalized',
              name: 'AF Aveiro Campeonato Sabseg',
              nation: 'Portugalia',
              normalized: 'Divisões Regionais',
              suggestedMatch: {
                name: 'Divisões Regionais',
                nation: 'Portugalia',
                rank: 18,
                stars: 0.5
              },
              suggestedRank: 18,
              suggestedStars: 0.5
            }
          ],
          subGroups: [
            {
              country: 'Portugalia',
              displayName: 'Divisões Regionais',
              key: 'divisoes|Portugalia',
              leagues: [
                {
                  countryCode: 'POR',
                  matchScore: null,
                  matchType: 'normalized',
                  name: 'AF Aveiro Campeonato Sabseg',
                  nation: 'Portugalia',
                  normalized: 'Divisões Regionais',
                  suggestedMatch: {
                    name: 'Divisões Regionais',
                    nation: 'Portugalia',
                    rank: 18,
                    stars: 0.5
                  },
                  suggestedRank: 18,
                  suggestedStars: 0.5
                }
              ],
              normalizedName: 'Divisões Regionais'
            }
          ]
        }
      ],
      hasCheckedMissingLeagues: true,
      isPanelVisible: true,
      isRechecking: false,
      missingLeagues: [
        {
          countryCode: 'POR',
          matchScore: null,
          matchType: 'normalized',
          name: 'AF Aveiro Campeonato Sabseg',
          nation: 'Portugalia',
          normalized: 'Divisões Regionais',
          suggestedMatch: {
            name: 'Divisões Regionais',
            nation: 'Portugalia',
            rank: 18,
            stars: 0.5
          },
          suggestedRank: 18,
          suggestedStars: 0.5
        }
      ],
      recheckSummary: null,
      selectedLeagueNames: []
    });

    act(() => {
      root.render(
        <>
          <LdcMissingPanelTrigger />
          <LdcMissingPanel />
        </>
      );
    });

    expect(container.textContent).not.toContain('Divisões Regionais');

    const countryToggleButtons = [...container.querySelectorAll<HTMLButtonElement>('button')];
    const countryButton = countryToggleButtons.find((button) =>
      button.textContent?.includes('Portugalia')
    );

    act(() => {
      countryButton?.click();
    });

    expect(container.textContent).toContain('Divisões Regionais');
    expect(useLdcMissingStore.getState().selectedLeagueNames).toEqual([]);

    const subgroupButton = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.includes('Divisões Regionais')
    );

    act(() => {
      subgroupButton?.click();
    });

    expect(container.textContent).toContain('AF Aveiro Campeonato Sabseg');
  });

  it('shows a calm success state when missing leagues were checked and none remain', () => {
    useLdcMissingStore.setState({
      groups: [],
      hasCheckedMissingLeagues: true,
      isPanelVisible: true,
      isRechecking: false,
      missingLeagues: [],
      recheckSummary: null,
      selectedLeagueNames: []
    });

    act(() => {
      root.render(
        <>
          <LdcMissingPanelTrigger />
          <LdcMissingPanel />
        </>
      );
    });

    expect(container.querySelector('#ldc-show-missing-btn')?.textContent).toContain(
      'Brakujące ligi'
    );
    expect(container.textContent).toContain('Nie wykryto brakujących lig');
  });

  it('runs recheck through the compat wrapper and shows a summary', () => {
    vi.mocked(detectMissingLeagues)
      .mockReturnValueOnce(sampleState.missingLeagues)
      .mockReturnValueOnce([]);

    act(() => {
      root.render(
        <>
          <LdcMissingPanelTrigger />
          <LdcMissingPanel />
        </>
      );
      useLdcMissingStore.getState().showPanel();
    });

    const recheckButton = container.querySelector<HTMLButtonElement>('#ldc-recheck-missing-btn');
    act(() => {
      recheckButton?.click();
      vi.advanceTimersByTime(100);
    });

    expect(checkMissingLeagues).toHaveBeenCalledTimes(1);
    expect(container.querySelector('#ldc-recheck-result')?.textContent).toContain(
      'Wszystkie ligi zostały dodane'
    );
  });
});
