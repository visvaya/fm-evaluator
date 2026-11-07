import { ChevronDown, Info, Redo2, Undo2, X } from 'lucide-react';
import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';

import { ldcSettings } from '@/config/ldcConfig';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { checkMissingLeagues } from '@/ui/ldcMissing';
import { applyLdcChangesAction, calculateLDC, resetLdcSettingsAction } from '@/ui/ldcModal';
import { loadDefaultLeaguesAction } from '@/ui/ldcModalBindings';
import {
  exportLdcMappingsAction,
  exportLdcSettingsAction,
  importLdcMappingsFileAction,
  importLdcSettingsFileAction,
  openLdcImportFilePicker,
  openLdcImportMappingsFilePicker
} from '@/ui/ldcModalImportExport';

import { LdcLeaguesSection } from './LdcLeaguesSection';
import { LdcMappingsModal } from './LdcMappingsPanel';
import { LdcMissingDialogs } from './LdcMissingDialogs';
import { LdcMissingPanel, LdcMissingPanelTrigger } from './LdcMissingPanel';
import { useLdcStore } from './useLdcStore';

export function LdcModalCompat() {
  const closeLdc = useWorkspaceStore((state) => state.closeLdc);
  const isLdcOpen = useWorkspaceStore((state) => state.isLdcOpen);
  const {
    beginEditSession,
    cancelEditSession,
    historyIndex,
    historyStack,
    hydrateFromPersistence,
    isHydrated,
    isHydrating,
    redo,
    setAlphaBasket,
    setAlphaSimple,
    setEnabled,
    setModel,
    settings,
    syncFromLegacy,
    undo
  } = useLdcStore();
  const canRedo = historyIndex < historyStack.length - 1;
  const canUndo = historyIndex > 0;
  const [baseLeagueQuery, setBaseLeagueQuery] = useState(settings.baseLeague);
  const [isBaseLeagueDropdownOpen, setIsBaseLeagueDropdownOpen] = useState(false);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [isMappingsModalOpen, setIsMappingsModalOpen] = useState(false);
  const [baseLeagueDropdownStyle, setBaseLeagueDropdownStyle] = useState<null | Record<
    string,
    number
  >>(null);
  const [importMenuStyle, setImportMenuStyle] = useState<null | Record<string, number | string>>(
    null
  );
  const baseLeagueFieldRef = useRef<HTMLDivElement | null>(null);
  const baseLeagueInputRef = useRef<HTMLInputElement | null>(null);
  const baseLeagueDropdownRef = useRef<HTMLDivElement | null>(null);
  const importMenuButtonRef = useRef<HTMLDivElement | null>(null);
  const importMenuDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setBaseLeagueQuery(settings.baseLeague);
    setIsBaseLeagueDropdownOpen(false);
  }, [settings.baseLeague]);

  useEffect(() => {
    if (isHydrated || isHydrating) {
      return;
    }

    startTransition(() => {
      void hydrateFromPersistence();
    });
  }, [hydrateFromPersistence, isHydrated, isHydrating]);

  useEffect(() => {
    if (!isHydrated || !isLdcOpen) {
      return;
    }

    const renderTimer = window.setTimeout(() => {
      void (async () => {
        await syncFromLegacy({ pushHistory: false });
        beginEditSession();
      })();
    }, 0);
    const missingLeaguesTimer = window.setTimeout(() => {
      checkMissingLeagues();
    }, 32);

    return () => {
      window.clearTimeout(renderTimer);
      window.clearTimeout(missingLeaguesTimer);
    };
  }, [beginEditSession, isHydrated, isLdcOpen, syncFromLegacy]);

  useEffect(() => {
    document.body.style.overflow = isLdcOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isLdcOpen]);

  useEffect(() => {
    if (!isImportMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !importMenuButtonRef.current?.contains(target) &&
        !importMenuDropdownRef.current?.contains(target)
      ) {
        setIsImportMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isImportMenuOpen]);

  const updateImportMenuPosition = useCallback(() => {
    const button = importMenuButtonRef.current;
    if (!button) {
      return;
    }

    const rect = button.getBoundingClientRect();
    const viewportPadding = 12;
    const dropdownWidth = 320;
    const actualMenuHeight = importMenuDropdownRef.current?.scrollHeight ?? 320;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openUpward = spaceBelow < actualMenuHeight && spaceAbove > spaceBelow;
    const rawAvailableHeight = (openUpward ? spaceAbove : spaceBelow) - 8;
    const needsScroll = rawAvailableHeight > 0 && actualMenuHeight > rawAvailableHeight;
    const renderedHeight = needsScroll ? Math.max(160, rawAvailableHeight) : actualMenuHeight;
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - dropdownWidth - viewportPadding
    );
    const top = openUpward
      ? Math.max(viewportPadding, rect.top - renderedHeight - 8)
      : rect.bottom + 8;

    setImportMenuStyle({
      left,
      maxHeight: needsScroll ? renderedHeight : 'none',
      overflowY: needsScroll ? 'auto' : 'visible',
      top,
      width: dropdownWidth
    });
  }, []);

  useEffect(() => {
    if (!isLdcOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInput =
        activeElement &&
        (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');

      if (isInput || !(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }

      if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) {
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLdcOpen, redo, undo]);

  const handleModelChange = (model: 'basket' | 'simple') => {
    setModel(model);
  };

  const handleAlphaBasketChange = (value: string) => {
    setAlphaBasket(parseFloat(value) || 1.7);
  };

  const handleAlphaSimpleChange = (value: string) => {
    setAlphaSimple(parseFloat(value) || 5.3);
  };

  const handleUndo = () => {
    undo();
  };

  const handleRedo = () => {
    redo();
  };

  const handleCancel = () => {
    closeLdc();
    void cancelEditSession();
  };

  const importExportActions = {
    calculateLDC,
    onMappingsChanged: () => {
      void syncFromLegacy({ pushHistory: false });
      checkMissingLeagues();
    },
    onSettingsChanged: () => {
      void syncFromLegacy();
    }
  };
  const baseLeagueMatches = useMemo(() => {
    const query = baseLeagueQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return settings.leagues
      .filter((league) => league.name.toLowerCase().includes(query))
      .slice(0, 10);
  }, [baseLeagueQuery, settings.leagues]);
  const activeModelDetails =
    settings.model === 'basket'
      ? {
          alphaId: 'ldc-alpha-basket',
          alphaLabel: 'Alpha (Koszykowy)',
          alphaMax: '10',
          alphaTitle:
            'Model koszykowy używa gwiazdek jako tierów, a rankingu do porządkowania lig wewnątrz danego koszyka. Wyższa alpha mocniej rozciąga różnice między ligami.',
          alphaValue: String(settings.alphaBasket),
          description:
            'Model koszykowy grupuje ligi według gwiazdek, a następnie rozkłada siłę wewnątrz każdego koszyka na podstawie rankingu.',
          onChange: handleAlphaBasketChange
        }
      : {
          alphaId: 'ldc-alpha-simple',
          alphaLabel: 'Alpha (Prosty)',
          alphaMax: '20',
          alphaTitle:
            'Model prosty ignoruje gwiazdki i liczy siłę ligi wyłącznie z pozycji w rankingu. Wyższa alpha mocniej rozciąga różnice między ligami.',
          alphaValue: String(settings.alphaSimple),
          description:
            'Model prosty opiera się tylko na kolejności rankingu. Gwiazdki nie biorą udziału w obliczeniach.',
          onChange: handleAlphaSimpleChange
        };

  const selectBaseLeague = (league: { name: string; nation: string }) => {
    ldcSettings.baseLeague = league.name;
    ldcSettings.baseLeagueNation = league.nation;
    setBaseLeagueQuery(league.name);
    setIsBaseLeagueDropdownOpen(false);
    calculateLDC();
    void syncFromLegacy();
  };

  const updateBaseLeagueDropdownPosition = useCallback(() => {
    const input = baseLeagueInputRef.current;
    if (!input) {
      return;
    }

    const rect = input.getBoundingClientRect();
    const viewportPadding = 12;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(240, openUpward ? spaceAbove - 8 : spaceBelow - 8));
    const top = openUpward ? Math.max(viewportPadding, rect.top - maxHeight - 4) : rect.bottom + 4;

    setBaseLeagueDropdownStyle({
      left: rect.left,
      maxHeight,
      top,
      width: rect.width
    });
  }, []);

  useLayoutEffect(() => {
    if (!isBaseLeagueDropdownOpen || baseLeagueMatches.length === 0) {
      return;
    }

    updateBaseLeagueDropdownPosition();

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (
        baseLeagueFieldRef.current?.contains(target) ||
        baseLeagueDropdownRef.current?.contains(target)
      ) {
        return;
      }

      setIsBaseLeagueDropdownOpen(false);
    };

    const handleViewportChange = () => {
      updateBaseLeagueDropdownPosition();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [baseLeagueMatches.length, isBaseLeagueDropdownOpen, updateBaseLeagueDropdownPosition]);

  useLayoutEffect(() => {
    if (!isImportMenuOpen) {
      return;
    }

    updateImportMenuPosition();
    const animationFrame = window.requestAnimationFrame(() => {
      updateImportMenuPosition();
    });

    const handleViewportChange = () => {
      updateImportMenuPosition();
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [isImportMenuOpen, updateImportMenuPosition]);

  return (
    <div
      id="ldc-modal"
      role="dialog"
      aria-modal="true"
      aria-hidden={!isLdcOpen}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          handleCancel();
        }
      }}
      className={cn(
        'fixed inset-0 z-[110] flex items-center justify-center bg-background/70 px-4',
        !isLdcOpen && 'invisible opacity-0 pointer-events-none'
      )}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-6xl flex-col rounded-2xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-text-primary">
            LDC {'–'} League Difficulty Coefficient
          </h2>
          <button
            id="ldc-close"
            type="button"
            onClick={() => {
              handleCancel();
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border text-text-secondary transition hover:bg-surface hover:text-text-primary"
            aria-label="Zamknij"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="custom-scroll flex-1 space-y-3 overflow-y-auto p-4">
          {/* Enable LDC */}
          <div className="rounded-xl border border-border bg-surface/35 p-2.5">
            <label className="flex cursor-pointer items-center gap-2.5">
              <input
                id="ldc-enabled"
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) => {
                  setEnabled(event.target.checked);
                }}
                className="h-4 w-4 accent-accent"
              />
              <span className="text-sm font-semibold text-text-primary">Włącz LDC</span>
            </label>
            <p className="ml-[26px] mt-1 text-xs text-text-muted">
              LDC (League Difficulty Coefficient) koryguje siłę ligi, aby statystyki zawodników były
              łatwiej porównywalne między rozgrywkami o różnym poziomie.
            </p>
            <p className="ml-[26px] mt-1 text-xs text-text-muted">
              LDC będzie stosowane tylko do statystyk objętościowych (Volume Stats), nie do
              statystyk efektywności.
            </p>
          </div>

          {/* Calculation model + Alpha parameters (merged) */}
          <div className="rounded-xl border border-border bg-surface/35 p-2.5">
            <div className="mb-2 flex items-center gap-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-text-muted">
                Model i parametry
              </label>
              <span
                className="inline-flex cursor-help items-center text-text-muted"
                title="Koszykowy: używa gwiazdek do tworzenia tierów, a rankingu do porządku w obrębie tieru. Prosty: ignoruje gwiazdki i liczy siłę lig wyłącznie z rankingu. Alpha określa, jak mocno różnice w wejściowym score przekładają się na końcowy multiplier."
              >
                <Info className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs text-text-muted">Model obliczeń</p>
                <div className="flex gap-5">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="ldc-model"
                      value="basket"
                      checked={settings.model === 'basket'}
                      onChange={() => {
                        handleModelChange('basket');
                      }}
                      className="accent-accent"
                      title="Koszykowy: oparty na gwiazdkach i koszykach"
                    />
                    <span className="text-sm text-text-primary">Koszykowy (Tiered/Bucket)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="ldc-model"
                      value="simple"
                      checked={settings.model === 'simple'}
                      onChange={() => {
                        handleModelChange('simple');
                      }}
                      className="accent-accent"
                      title="Prosty: oparty tylko na rankingu"
                    />
                    <span className="text-sm text-text-primary">Prosty (Rank Based)</span>
                  </label>
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                <div className="mb-2 text-xs text-text-muted">{activeModelDetails.description}</div>
                <label
                  className="mb-1 block text-xs text-text-secondary"
                  htmlFor={activeModelDetails.alphaId}
                  title={activeModelDetails.alphaTitle}
                >
                  {activeModelDetails.alphaLabel}
                </label>
                <input
                  type="number"
                  id={activeModelDetails.alphaId}
                  value={activeModelDetails.alphaValue}
                  onChange={(event) => {
                    activeModelDetails.onChange(event.target.value);
                  }}
                  step="0.1"
                  min="0.1"
                  max={activeModelDetails.alphaMax}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
                  title={activeModelDetails.alphaTitle}
                />
              </div>
            </div>
          </div>

          {/* Base league */}
          <div
            ref={baseLeagueFieldRef}
            className="rounded-xl border border-border bg-surface/35 p-2.5"
          >
            <label
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-muted"
              title="Liga odniesienia z multiplierem 1.000. Wszystkie inne ligi są przeliczane względem niej"
            >
              Liga bazowa (normalizacja)
            </label>
            <p className="mb-2 text-xs text-text-muted">
              Ta liga będzie miała mnożnik 1.000x. Wszystkie inne ligi będą przeliczane względem
              niej.
            </p>
            <input
              ref={baseLeagueInputRef}
              type="text"
              id="ldc-base-league"
              value={baseLeagueQuery}
              onChange={(event) => {
                setBaseLeagueQuery(event.target.value);
                setIsBaseLeagueDropdownOpen(true);
              }}
              onFocus={() => {
                if (baseLeagueMatches.length > 0) {
                  setIsBaseLeagueDropdownOpen(true);
                }
              }}
              placeholder="Wyszukaj ligę..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
              title="Liga odniesienia z multiplierem 1.000. Wszystkie inne ligi są przeliczane względem niej"
            />
          </div>

          {/* LDC Tools */}
          <div className="rounded-xl border border-border bg-surface/35 p-2.5">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-muted">
              Narzędzia LDC
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                type="file"
                id="ldc-import-file"
                accept=".csv,.html,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (!file) {
                    return;
                  }

                  void importLdcSettingsFileAction(file, importExportActions);
                  event.currentTarget.value = '';
                }}
              />
              <input
                type="file"
                id="ldc-import-mappings-file"
                accept=".json"
                className="hidden"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (!file) {
                    return;
                  }

                  void importLdcMappingsFileAction(file, importExportActions);
                  event.currentTarget.value = '';
                }}
              />
              <div ref={importMenuButtonRef} className="relative">
                <button
                  id="ldc-import-btn"
                  type="button"
                  onClick={() => {
                    setIsImportMenuOpen((current) => !current);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-primary transition hover:bg-surface"
                  aria-expanded={isImportMenuOpen}
                  aria-haspopup="menu"
                  title="Importuj lub eksportuj pełne ustawienia LDC oraz osobne mapowania lig."
                >
                  <span>Importuj/eksportuj ustawienia</span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 text-text-muted transition-transform',
                      isImportMenuOpen ? 'rotate-180' : ''
                    )}
                  />
                </button>
              </div>
              <LdcMissingPanelTrigger />
              <button
                id="ldc-manage-mappings-btn"
                type="button"
                onClick={() => {
                  setIsMappingsModalOpen(true);
                }}
                className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-primary transition hover:bg-surface"
              >
                Zarządzaj mapowaniami
              </button>
              <button
                id="ldc-load-default-btn"
                type="button"
                onClick={() => {
                  void loadDefaultLeaguesAction({
                    calculateLDC,
                    onSettingsChanged: () => {
                      void syncFromLegacy();
                    }
                  });
                }}
                className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface"
                title="Ładuje wbudowaną, domyślną listę lig dla bieżącego modelu LDC. Nie resetuje modelu, wartości alpha ani ligi bazowej."
              >
                Załaduj domyślny spis lig
              </button>
            </div>
          </div>

          <LdcMissingPanel />

          <LdcMappingsModal
            isOpen={isMappingsModalOpen}
            onRequestClose={() => {
              setIsMappingsModalOpen(false);
            }}
          />

          <LdcLeaguesSection />
          <LdcMissingDialogs />
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-border px-6 py-4">
          <div id="ldc-modal-error" className="min-h-[1rem] text-xs text-negative" />
          <div className="flex gap-2">
            <button
              id="ldc-undo"
              type="button"
              disabled={!canUndo}
              onClick={handleUndo}
              className="inline-flex items-center rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
              title="Cofnij ostatnią zmianę (Ctrl+Z)"
            >
              <Undo2 className="mr-1 h-3.5 w-3.5" /> Cofnij
            </button>
            <button
              id="ldc-redo"
              type="button"
              disabled={!canRedo}
              onClick={handleRedo}
              className="inline-flex items-center rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-secondary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
              title="Przywróć cofniętą zmianę (Ctrl+Y)"
            >
              <Redo2 className="mr-1 h-3.5 w-3.5" /> Przywróć
            </button>
            <button
              id="ldc-reset"
              type="button"
              onClick={() => {
                void resetLdcSettingsAction();
              }}
              className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-negative transition hover:bg-negative/10"
              title="Przywraca pełny domyślny stan LDC: wyłącza LDC, ustawia model koszykowy, resetuje alpha i ligę bazową oraz odtwarza domyślną listę lig. Może też usunąć mapowania."
            >
              Reset
            </button>
            <button
              id="ldc-close-bottom"
              type="button"
              onClick={() => {
                handleCancel();
              }}
              className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-text-primary transition hover:bg-surface"
            >
              Anuluj
            </button>
            <button
              id="ldc-apply"
              type="button"
              onClick={() => {
                void applyLdcChangesAction();
              }}
              className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover"
            >
              Zastosuj
            </button>
          </div>
        </div>
      </div>
      {isBaseLeagueDropdownOpen && baseLeagueMatches.length > 0 && baseLeagueDropdownStyle
        ? createPortal(
            <div
              ref={baseLeagueDropdownRef}
              id="ldc-base-league-dropdown"
              className="fixed z-[120] overflow-y-auto rounded-xl border border-border bg-background shadow-2xl"
              style={baseLeagueDropdownStyle}
            >
              {baseLeagueMatches.map((league) => (
                <button
                  key={league.id ?? `${league.name}-${league.nation}`}
                  className="block w-full border-b border-border px-3 py-2 text-left text-sm text-text-primary last:border-b-0 hover:bg-surface"
                  data-league={league.name}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => {
                    selectBaseLeague(league);
                  }}
                  type="button"
                >
                  <span className="block">{league.name}</span>
                  <span className="block text-xs text-text-muted">
                    {league.nation || 'Brak kraju'}
                  </span>
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
      {isImportMenuOpen && importMenuStyle
        ? createPortal(
            <div
              ref={importMenuDropdownRef}
              className="fixed z-[120] rounded-xl border border-border bg-background p-2 shadow-2xl"
              role="menu"
              style={importMenuStyle}
            >
              <button
                id="ldc-import-settings-btn"
                type="button"
                onClick={() => {
                  setIsImportMenuOpen(false);
                  openLdcImportFilePicker();
                }}
                className="w-full rounded-lg px-3 py-2 text-left transition hover:bg-surface"
                role="menuitem"
              >
                <span className="block text-sm font-semibold text-text-primary">
                  Importuj ustawienia LDC
                </span>
                <span className="mt-0.5 block text-xs text-text-muted">
                  Importuje listę lig, model, parametry alpha i opcjonalnie mapowania z pliku LDC.
                </span>
              </button>
              <button
                id="ldc-export-settings-btn"
                type="button"
                onClick={() => {
                  setIsImportMenuOpen(false);
                  exportLdcSettingsAction();
                }}
                className="mt-1 w-full rounded-lg px-3 py-2 text-left transition hover:bg-surface"
                role="menuitem"
              >
                <span className="block text-sm font-semibold text-text-primary">
                  Eksportuj ustawienia LDC
                </span>
                <span className="mt-0.5 block text-xs text-text-muted">
                  Eksportuje pełny stan LDC: ligi, model, parametry, ligę bazową i mapowania.
                </span>
              </button>
              <button
                id="ldc-import-mappings-btn"
                type="button"
                onClick={() => {
                  setIsImportMenuOpen(false);
                  openLdcImportMappingsFilePicker();
                }}
                className="mt-1 w-full rounded-lg px-3 py-2 text-left transition hover:bg-surface"
                role="menuitem"
              >
                <span className="block text-sm font-semibold text-text-primary">
                  Importuj mapowania lig
                </span>
                <span className="mt-0.5 block text-xs text-text-muted">
                  Importuje tylko reguły dopasowań lig i scala je z obecnymi mapowaniami.
                </span>
              </button>
              <button
                id="ldc-export-mappings-btn"
                type="button"
                onClick={() => {
                  setIsImportMenuOpen(false);
                  exportLdcMappingsAction();
                }}
                className="mt-1 w-full rounded-lg px-3 py-2 text-left transition hover:bg-surface"
                role="menuitem"
              >
                <span className="block text-sm font-semibold text-text-primary">
                  Eksportuj mapowania lig
                </span>
                <span className="mt-0.5 block text-xs text-text-muted">
                  Eksportuje wyłącznie zapisane reguły dopasowań lig do osobnego pliku JSON.
                </span>
              </button>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
