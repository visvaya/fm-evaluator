import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

import { defaultSettings, parseSettingsInput, type AppSettings } from '@/config/settingsModel';
import { rerunCurrentAnalysis } from '@/lib/legacyActionBridge';
import { persistUIState } from '@/lib/uiBridge';
import { requestTableSync } from '@/lib/reactTableCompat';
import { saveSettings } from '@/storage/db';
import { markFiltersDirty } from '@/store/tableStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';

interface FormDraft {
  ldcFilterEnabled: boolean;
  ldcFilterMax: string;
  ldcFilterMin: string;
  maxBeeswarmPlayers: string;
  minMins: string;
  normalizeAttr: boolean;
  normalizeStat: boolean;
  normalizeTotal: boolean;
  pAdjEnabled: boolean;
  penaltyXGFactor: string;
  percentile: string;
  rememberLanguageChoice: boolean;
}

function toDraft(settings: AppSettings, rememberLang: boolean): FormDraft {
  const displayedMinMins =
    settings.minMins === null
      ? settings.adaptiveMinMins == null
        ? ''
        : String(settings.adaptiveMinMins)
      : String(settings.minMins);

  return {
    ldcFilterEnabled: settings.ldcFilterEnabled,
    ldcFilterMax: String(settings.ldcFilterMax),
    ldcFilterMin: String(settings.ldcFilterMin),
    maxBeeswarmPlayers: String(settings.maxBeeswarmPlayers),
    minMins: displayedMinMins,
    normalizeAttr: settings.normalizeAttr,
    normalizeStat: settings.normalizeStat,
    normalizeTotal: settings.normalizeTotal,
    pAdjEnabled: settings.pAdjEnabled,
    penaltyXGFactor: String(settings.penaltyXGFactor),
    percentile: String(settings.percentile),
    rememberLanguageChoice: rememberLang
  };
}

export function SettingsShell() {
  const settings = useSettingsStore((s) => s.settings);
  const applySettings = useSettingsStore((s) => s.applySettings);
  const isSettingsOpen = useWorkspaceStore((s) => s.isSettingsOpen);
  const modalRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState<FormDraft>(() =>
    toDraft(settings, localStorage.getItem('fm24-evaluator-remember-language-choice') === 'true')
  );

  useEffect(() => {
    if (isSettingsOpen) {
      setDraft(
        toDraft(
          useSettingsStore.getState().settings,
          localStorage.getItem('fm24-evaluator-remember-language-choice') === 'true'
        )
      );
    }
  }, [isSettingsOpen]);

  const normWarning = (() => {
    if (draft.normalizeStat && draft.normalizeAttr)
      return 'Stat + Attr: Total jest automatycznie średnią znormalizowanych wartości';
    if (draft.normalizeTotal)
      return 'Total: Stat i Attr są zablokowane (Total normalizuje się niezależnie)';
    return null;
  })();

  const totalDisabled = draft.normalizeStat && draft.normalizeAttr;
  const statAttrDisabled = draft.normalizeTotal;

  const handleClose = () => {
    modalRef.current?.classList.add('hidden');
  };

  const handleNormChange = (
    field: 'normalizeAttr' | 'normalizeStat' | 'normalizeTotal',
    checked: boolean
  ) => {
    setDraft((d) => ({ ...d, [field]: checked }));
  };

  const handleSave = async () => {
    const parsed = parseSettingsInput(draft);
    applySettings(parsed);
    localStorage.setItem(
      'fm24-evaluator-remember-language-choice',
      String(draft.rememberLanguageChoice)
    );
    handleClose();
    persistUIState();
    try {
      await saveSettings(useSettingsStore.getState().settings);
    } catch {
      // best-effort Dexie persist
    }
    markFiltersDirty();
    requestTableSync();
    rerunCurrentAnalysis();
  };

  const handleResetAll = () => {
    setDraft((d) =>
      toDraft(
        {
          ...defaultSettings,
          adaptiveMinMins: useSettingsStore.getState().settings.adaptiveMinMins
        },
        d.rememberLanguageChoice
      )
    );
  };

  return (
    <div
      ref={modalRef}
      id="settings-modal"
      className="hidden fixed inset-0 z-[130] flex items-center justify-center bg-background/70 px-4"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-background p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
          <button
            id="close-settings"
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border text-text-secondary transition hover:bg-surface hover:text-text-primary"
            aria-label="Zamknij"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm text-text-primary">
            <span>Percentile</span>
            <input
              id="setting-percentile"
              type="number"
              value={draft.percentile}
              onChange={(e) => setDraft((d) => ({ ...d, percentile: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              id="reset-percentile"
              type="button"
              className="text-left text-xs text-text-muted hover:text-text-secondary transition"
              onClick={() => setDraft((d) => ({ ...d, percentile: '95' }))}
            >
              Reset
            </button>
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-text-primary">
            <span>Minimum minutes</span>
            <input
              id="setting-min-minutes"
              type="number"
              value={draft.minMins}
              onChange={(e) => setDraft((d) => ({ ...d, minMins: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              id="reset-min-minutes"
              type="button"
              className="text-left text-xs text-text-muted hover:text-text-secondary transition"
              onClick={() => {
                const s = useSettingsStore.getState().settings;
                setDraft((d) => ({
                  ...d,
                  minMins: s.adaptiveMinMins == null ? '' : String(s.adaptiveMinMins)
                }));
              }}
            >
              Reset
            </button>
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-text-primary">
            <span>Beeswarm limit</span>
            <input
              id="setting-max-beeswarm-players"
              type="number"
              value={draft.maxBeeswarmPlayers}
              onChange={(e) => setDraft((d) => ({ ...d, maxBeeswarmPlayers: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              id="reset-max-beeswarm-players"
              type="button"
              className="text-left text-xs text-text-muted hover:text-text-secondary transition"
              onClick={() => setDraft((d) => ({ ...d, maxBeeswarmPlayers: '500' }))}
            >
              Reset
            </button>
          </label>

          <label className="flex flex-col gap-1.5 text-sm text-text-primary">
            <span>Penalty xG factor</span>
            <input
              id="setting-penalty-xg-factor"
              type="number"
              step="0.01"
              value={draft.penaltyXGFactor}
              onChange={(e) => setDraft((d) => ({ ...d, penaltyXGFactor: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              id="reset-penalty-xg-factor"
              type="button"
              className="text-left text-xs text-text-muted hover:text-text-secondary transition"
              onClick={() => setDraft((d) => ({ ...d, penaltyXGFactor: '0.76' }))}
            >
              Reset
            </button>
          </label>
        </div>

        <div className="mt-5 grid gap-2.5">
          <label className="flex items-center gap-2.5 text-sm text-text-primary">
            <input
              id="setting-normalize-total"
              type="checkbox"
              className="accent-accent"
              checked={draft.normalizeTotal}
              disabled={totalDisabled}
              onChange={(e) => handleNormChange('normalizeTotal', e.target.checked)}
            />
            <span>Normalize total</span>
          </label>
          <label className="flex items-center gap-2.5 text-sm text-text-primary">
            <input
              id="setting-normalize-stat"
              type="checkbox"
              className="accent-accent"
              checked={draft.normalizeStat}
              disabled={statAttrDisabled}
              onChange={(e) => handleNormChange('normalizeStat', e.target.checked)}
            />
            <span>Normalize stat</span>
          </label>
          <label className="flex items-center gap-2.5 text-sm text-text-primary">
            <input
              id="setting-normalize-attr"
              type="checkbox"
              className="accent-accent"
              checked={draft.normalizeAttr}
              disabled={statAttrDisabled}
              onChange={(e) => handleNormChange('normalizeAttr', e.target.checked)}
            />
            <span>Normalize attr</span>
          </label>
          <label className="flex items-center gap-2.5 text-sm text-text-primary">
            <input
              id="setting-remember-language-choice"
              type="checkbox"
              className="accent-accent"
              checked={draft.rememberLanguageChoice}
              onChange={(e) =>
                setDraft((d) => ({ ...d, rememberLanguageChoice: e.target.checked }))
              }
            />
            <span>Remember file language choice</span>
          </label>
          {normWarning === null ? (
            <p id="normalization-warning" className="hidden" />
          ) : (
            <p
              id="normalization-warning"
              className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning"
            >
              {normWarning}
            </p>
          )}
        </div>

        <div className="mt-5 rounded-xl border border-border p-4">
          <label className="flex items-center gap-2.5 text-sm text-text-primary">
            <input
              id="ldc-filter-enabled"
              type="checkbox"
              className="accent-accent"
              checked={draft.ldcFilterEnabled}
              onChange={(e) => setDraft((d) => ({ ...d, ldcFilterEnabled: e.target.checked }))}
            />
            <span>Enable LDC filter</span>
          </label>
          <div
            id="ldc-filter-inputs"
            className={`mt-3 grid gap-3 md:grid-cols-2${draft.ldcFilterEnabled ? '' : ' hidden'}`}
          >
            <input
              id="ldc-filter-min"
              type="number"
              value={draft.ldcFilterMin}
              onChange={(e) => setDraft((d) => ({ ...d, ldcFilterMin: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <input
              id="ldc-filter-max"
              type="number"
              value={draft.ldcFilterMax}
              onChange={(e) => setDraft((d) => ({ ...d, ldcFilterMax: e.target.value }))}
              className="rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-border p-4">
          <label className="flex items-center gap-2.5 text-sm text-text-primary">
            <input
              id="setting-padj-enabled"
              type="checkbox"
              className="accent-accent"
              checked={draft.pAdjEnabled}
              onChange={(e) => setDraft((d) => ({ ...d, pAdjEnabled: e.target.checked }))}
            />
            <span>Possession adjustment (PAdj)</span>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            id="save-settings"
            type="button"
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover"
            onClick={() => void handleSave()}
          >
            Save
          </button>
          <button
            id="reset-all-settings"
            type="button"
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface"
            onClick={handleResetAll}
          >
            Reset all
          </button>
        </div>
      </div>
    </div>
  );
}
