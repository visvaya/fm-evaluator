// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadLeagueMappings } from '@/computing/ldcMappings';
import { ldcMappingState, ldcSettings } from '@/config/ldcConfig';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';

import { LdcModalCompat } from './LdcModalCompat';
import { useLdcStore } from './useLdcStore';

describe('LdcModalCompat', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    const store: Record<string, string> = {};
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] || null),
      removeItem: vi.fn((key: string) => {
        store[key] = '';
      }),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      })
    });
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('addAudit', vi.fn());
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false)
    );
    vi.stubGlobal('DEFAULT_LEAGUE_DATA', [
      { name: 'Premier League', nation: 'ENG', stars: 5 },
      { name: 'Serie A', nation: 'ITA', stars: 4 }
    ]);
    ldcMappingState.cache = null;
    ldcMappingState.initPromise = null;
    useWorkspaceStore.setState({
      activeRailSection: 'none',
      graphicsEnabled: true,
      isDiagnosticsOpen: false,
      isFileManagerOpen: false,
      isLdcOpen: true,
      isSettingsOpen: false,
      lastFocusedElement: null
    } as any);
    useLdcStore.setState({
      basketProblems: [],
      historyIndex: 0,
      historyStack: [
        {
          alphaBasket: 1.7,
          alphaSimple: 5.3,
          baseLeague: 'Premier League',
          enabled: false,
          leagues: [],
          mappings: {},
          model: 'basket',
          sortColumn: 'rank',
          sortDirection: 'asc',
          timestamp: Date.now()
        }
      ],
      isHydrated: true,
      isHydrating: false,
      isLeaguesExpanded: false,
      leagueFilter: 'all',
      orderProblems: [],
      searchTerm: '',
      selectedLeagueIds: [],
      settings: {
        alphaBasket: 1.7,
        alphaSimple: 5.3,
        baseLeague: 'Premier League',
        enabled: false,
        groupBy: null,
        leagues: [
          {
            id: 'league-1',
            inputScore: 100,
            ldcRaw: 1,
            multiplier: 1,
            name: 'Premier League',
            nation: 'ENG',
            rank: 1,
            stars: 5
          },
          {
            id: 'league-2',
            inputScore: 80,
            ldcRaw: 0.8,
            multiplier: 0.8,
            name: 'Serie A',
            nation: 'ITA',
            rank: 2,
            stars: 4
          }
        ],
        model: 'basket',
        sortColumn: 'rank',
        sortDirection: 'asc'
      }
    });
    ldcSettings.alphaBasket = 1.7;
    ldcSettings.alphaSimple = 5.3;
    ldcSettings.baseLeague = 'Premier League';
    ldcSettings.enabled = false;
    ldcSettings.groupBy = null;
    ldcSettings.leagues = [
      {
        id: 'league-1',
        inputScore: 100,
        ldcRaw: 1,
        multiplier: 1,
        name: 'Premier League',
        nation: 'ENG',
        rank: 1,
        stars: 5
      },
      {
        id: 'league-2',
        inputScore: 80,
        ldcRaw: 0.8,
        multiplier: 0.8,
        name: 'Serie A',
        nation: 'ITA',
        rank: 2,
        stars: 4
      }
    ];
    ldcSettings.model = 'basket';
    ldcSettings.sortColumn = 'rank';
    ldcSettings.sortDirection = 'asc';
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
  });

  it('renders the full compatibility shell for the LDC workflow', () => {
    act(() => {
      root.render(<LdcModalCompat />);
    });

    expect(container.querySelector('#ldc-modal')).not.toBeNull();
    expect(container.querySelector('#ldc-import-btn')).not.toBeNull();
    expect(container.textContent).toContain('Narzędzia LDC');
    expect(container.querySelector('#ldc-manage-mappings-btn')).not.toBeNull();
    expect(container.querySelector('#ldc-load-default-btn')).not.toBeNull();
    expect(container.querySelector('#ldc-base-league')).not.toBeNull();
    expect(container.querySelector('#ldc-missing-leagues')).not.toBeNull();
    expect(container.querySelector('#ldc-mappings-modal')).toBeNull();
    expect(container.querySelector('#ldc-leagues-toggle-btn')).not.toBeNull();
    expect(container.querySelector('#ldc-problems-section')).toBeNull();
    expect(container.querySelector('#ldc-apply')).not.toBeNull();
  });

  it('opens the unified import/export menu with full LDC and mapping file actions', () => {
    act(() => {
      root.render(<LdcModalCompat />);
    });

    const importButton = container.querySelector<HTMLButtonElement>('#ldc-import-btn');

    expect(document.querySelector('#ldc-import-settings-btn')).toBeNull();
    expect(document.querySelector('#ldc-export-settings-btn')).toBeNull();
    expect(document.querySelector('#ldc-import-mappings-btn')).toBeNull();
    expect(document.querySelector('#ldc-export-mappings-btn')).toBeNull();

    act(() => {
      importButton?.click();
    });

    expect(document.querySelector('#ldc-import-settings-btn')).not.toBeNull();
    expect(document.querySelector('#ldc-export-settings-btn')).not.toBeNull();
    expect(document.querySelector('#ldc-import-mappings-btn')).not.toBeNull();
    expect(document.querySelector('#ldc-export-mappings-btn')).not.toBeNull();
    expect(document.body.textContent).toContain('Importuj ustawienia LDC');
    expect(document.body.textContent).toContain('Importuje listę lig, model, parametry alpha');
    expect(document.body.textContent).toContain('Eksportuj ustawienia LDC');
    expect(document.body.textContent).toContain('Importuj mapowania lig');
    expect(document.body.textContent).toContain('Eksportuj mapowania lig');
  });

  it('binds React-owned controls to the LDC store', async () => {
    act(() => {
      root.render(<LdcModalCompat />);
    });

    const enabledCheckbox = container.querySelector<HTMLInputElement>('#ldc-enabled');
    const simpleModelRadio = container.querySelector<HTMLInputElement>(
      'input[name="ldc-model"][value="simple"]'
    );

    expect(enabledCheckbox).not.toBeNull();
    expect(simpleModelRadio).not.toBeNull();

    act(() => {
      enabledCheckbox?.click();
    });

    expect(useLdcStore.getState().settings.enabled).toBe(true);

    await act(async () => {
      simpleModelRadio?.click();
      await Promise.resolve();
    });

    expect(useLdcStore.getState().settings.model).toBe('simple');
  });

  it('closes the base league dropdown after selecting a league', () => {
    act(() => {
      root.render(<LdcModalCompat />);
    });

    const input = container.querySelector<HTMLInputElement>('#ldc-base-league');
    expect(input).not.toBeNull();
    if (!input) {
      throw new Error('Expected base league input');
    }

    act(() => {
      input.focus();
      input.value = 'Prem';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const dropdown = document.querySelector<HTMLElement>('#ldc-base-league-dropdown');
    expect(dropdown).not.toBeNull();

    const option = document.querySelector<HTMLButtonElement>('[data-league="Premier League"]');
    expect(option).not.toBeNull();

    act(() => {
      option?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      option?.click();
    });

    expect(document.querySelector('#ldc-base-league-dropdown')).toBeNull();
    expect(input?.value).toBe('Premier League');
  });

  it('renders league rows and filters them from the React-owned search state', () => {
    act(() => {
      root.render(<LdcModalCompat />);
    });

    const toggleButton = container.querySelector<HTMLButtonElement>('#ldc-leagues-toggle-btn');
    act(() => {
      toggleButton?.click();
    });

    const getRows = () => container.querySelectorAll('#ldc-leagues-tbody tr');

    expect(getRows()).toHaveLength(2);

    act(() => {
      useLdcStore.getState().setSearchTerm('serie');
    });

    const visibleNameInput = container.querySelector<HTMLInputElement>(
      '#ldc-leagues-tbody input[data-field="name"]'
    );

    expect(useLdcStore.getState().searchTerm).toBe('serie');
    expect(getRows()).toHaveLength(1);
    expect(visibleNameInput?.defaultValue).toBe('Serie A');
  });

  it('shows a warning when a country value is changed to a new unseen country', () => {
    act(() => {
      root.render(<LdcModalCompat />);
    });

    const toggleButton = container.querySelector<HTMLButtonElement>('#ldc-leagues-toggle-btn');
    act(() => {
      toggleButton?.click();
    });

    const nationInput = container.querySelector<HTMLInputElement>(
      '#ldc-leagues-tbody input[data-field="nation"][data-row-id="league-2"]'
    );
    expect(nationInput).not.toBeNull();
    if (!nationInput) {
      throw new Error('Expected nation input');
    }

    act(() => {
      nationInput.value = 'Nowakraj';
      nationInput.dispatchEvent(new Event('input', { bubbles: true }));
      nationInput.dispatchEvent(new Event('blur', { bubbles: true }));
    });

    expect(container.textContent).toContain('Ten kraj nie występował dotychczas');
  });

  it('adds a league through the React-owned add button handler and focuses it', () => {
    act(() => {
      root.render(<LdcModalCompat />);
    });

    const addLeagueButton = container.querySelector<HTMLButtonElement>('#ldc-add-league-btn');

    act(() => {
      addLeagueButton?.click();
    });

    const toggleButton = container.querySelector<HTMLButtonElement>('#ldc-leagues-toggle-btn');
    expect(toggleButton).not.toBeNull();
    expect(container.querySelector('#ldc-leagues-scroll')).not.toBeNull();
    expect(ldcSettings.leagues.at(-1)?.name).toBe('Nowa liga');
    expect(ldcSettings.leagues.at(-1)?.stars).toBe(4);
    expect(container.querySelectorAll('#ldc-leagues-tbody tr')).toHaveLength(3);
    const addedInput = container.querySelector<HTMLInputElement>(
      'input[data-field="name"][data-row-id^="ldc-ui-"]'
    );
    expect(addedInput).not.toBeNull();
    const addedStarsInput = container.querySelector<HTMLInputElement>(
      'input[data-field="stars"][data-row-id^="ldc-ui-"]'
    );
    expect(addedStarsInput?.defaultValue).toBe('4');
  });

  it('merges order and tiering inconsistencies for the same pair into one grouped problem', () => {
    useLdcStore.setState({
      basketProblems: [
        {
          ldcRaw: 0.5,
          leagues: [ldcSettings.leagues[0], ldcSettings.leagues[1]],
          suggestions: ['Rozważ zmianę gwiazdek']
        }
      ],
      orderProblems: [
        {
          league1: 'Premier League',
          league1Index: 0,
          league1Multiplier: 0.8,
          league1Rank: 1,
          league2: 'Serie A',
          league2Index: 1,
          league2Multiplier: 1,
          league2Rank: 2,
          suggestion: 'Zamień miejscami ligi'
        }
      ]
    });

    act(() => {
      root.render(<LdcModalCompat />);
    });

    expect(container.textContent).toContain('Wykryto 1 problem LDC');
    expect(container.textContent).toContain('Konflikty spójności');
    expect(container.querySelector('#ldc-align-stars-to-rank')).not.toBeNull();
    expect(container.querySelector('#ldc-align-rank-to-stars')).not.toBeNull();
    expect(container.querySelector('#ldc-repair-tiering')).not.toBeNull();
  });

  it('opens the mappings modal through the React-owned button handler', () => {
    act(() => {
      root.render(<LdcModalCompat />);
    });

    const manageMappingsButton = container.querySelector<HTMLButtonElement>(
      '#ldc-manage-mappings-btn'
    );
    expect(container.querySelector('#ldc-mappings-modal')).toBeNull();

    act(() => {
      manageMappingsButton?.click();
    });

    expect(container.querySelector('#ldc-mappings-modal')).not.toBeNull();
    const templateControls = [
      '#ldc-template-name',
      '#ldc-load-template',
      '#ldc-save-template-btn',
      '#ldc-load-template-btn',
      '#ldc-delete-template-btn'
    ].map((selector) => container.querySelector(selector) !== null);
    expect(templateControls).toEqual([true, true, true, true, true]);
  });

  it('stages mapping changes locally and saves them on apply', async () => {
    localStorage.setItem(
      'fm24-evaluator-ldc-mappings-v1',
      JSON.stringify({ Ekstraklasa: 'Premier League' })
    );
    ldcMappingState.cache = null;

    act(() => {
      root.render(<LdcModalCompat />);
    });

    const manageMappingsButton = container.querySelector<HTMLButtonElement>(
      '#ldc-manage-mappings-btn'
    );

    act(() => {
      manageMappingsButton?.click();
    });

    expect(container.textContent).toContain('Ekstraklasa');
    expect(loadLeagueMappings()).toEqual({
      Ekstraklasa: { name: 'Premier League', nation: 'ENG' }
    });

    const removeMappingButton =
      container.querySelector<HTMLButtonElement>('.ldc-remove-mapping-btn');

    act(() => {
      removeMappingButton?.click();
    });

    expect(loadLeagueMappings()).toEqual({
      Ekstraklasa: { name: 'Premier League', nation: 'ENG' }
    });
    expect(container.textContent).toContain('Brak zapisanych mapowań');

    const applyButton = container.querySelector<HTMLButtonElement>('#ldc-mappings-apply');

    await act(async () => {
      applyButton?.click();
      await Promise.resolve();
    });

    expect(loadLeagueMappings()).toEqual({});
    expect(container.textContent).not.toContain('Ekstraklasa');
    expect(container.querySelector('#ldc-mappings-modal')).toBeNull();
  });

  it('resets LDC settings through the React-owned reset button', async () => {
    ldcSettings.enabled = true;
    ldcSettings.baseLeague = 'Serie A';
    ldcSettings.alphaBasket = 2.2;
    ldcSettings.leagues = [
      {
        id: 'league-custom',
        inputScore: 90,
        ldcRaw: 0.9,
        multiplier: 0.9,
        name: 'Custom League',
        nation: 'POL',
        rank: 1,
        stars: 3
      }
    ];

    act(() => {
      root.render(<LdcModalCompat />);
    });

    const resetButton = container.querySelector<HTMLButtonElement>('#ldc-reset');

    await act(async () => {
      resetButton?.click();
      await Promise.resolve();
    });

    // Reset now confirms through the app modal instead of native confirm().
    const clickModalConfirm = async () => {
      const confirmButton = document.querySelector<HTMLButtonElement>('#modal-confirm-btn');
      expect(confirmButton).not.toBeNull();
      await act(async () => {
        confirmButton?.click();
        await Promise.resolve();
      });
    };

    await clickModalConfirm();
    await clickModalConfirm();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(ldcSettings.enabled).toBe(false);
    expect(ldcSettings.baseLeague).toBe('Premier League');
    expect(ldcSettings.model).toBe('basket');
    expect(ldcSettings.leagues[0]?.name).toBe('Premier League');
    expect(loadLeagueMappings()).toEqual({});
  });

  it('closes the modal when clicking the React-owned backdrop', () => {
    act(() => {
      root.render(<LdcModalCompat />);
    });

    const modalBackdrop = container.querySelector<HTMLDivElement>('#ldc-modal');

    act(() => {
      modalBackdrop?.click();
    });

    expect(useWorkspaceStore.getState().isLdcOpen).toBe(false);
  });

  it('handles undo via the React-owned keyboard shortcut', () => {
    useLdcStore.setState({
      historyIndex: 1,
      historyStack: [
        {
          alphaBasket: 1.7,
          alphaSimple: 5.3,
          baseLeague: 'Premier League',
          enabled: false,
          leagues: [
            {
              id: 'history-1',
              inputScore: 100,
              ldcRaw: 1,
              multiplier: 1,
              name: 'Premier League',
              nation: 'ENG',
              rank: 1,
              stars: 5
            }
          ],
          mappings: {},
          model: 'basket',
          sortColumn: 'rank',
          sortDirection: 'asc',
          timestamp: Date.now() - 1
        },
        {
          alphaBasket: 2.2,
          alphaSimple: 5.3,
          baseLeague: 'Premier League',
          enabled: false,
          leagues: [
            {
              id: 'history-2',
              inputScore: 100,
              ldcRaw: 1,
              multiplier: 1,
              name: 'Premier League',
              nation: 'ENG',
              rank: 1,
              stars: 5
            }
          ],
          mappings: {},
          model: 'basket',
          sortColumn: 'rank',
          sortDirection: 'asc',
          timestamp: Date.now()
        }
      ],
      settings: {
        ...useLdcStore.getState().settings,
        alphaBasket: 2.2
      }
    });

    act(() => {
      root.render(<LdcModalCompat />);
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, key: 'z' }));
    });

    expect(useLdcStore.getState().historyIndex).toBe(0);
  });
});
