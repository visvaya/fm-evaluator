import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import {
  applyServiceWorkerUpdate,
  buildDiagnosticsSnapshot,
  copyDiagnosticsSnapshot,
  createBackup,
  cycleWebVitalsMode,
  exportDiagnosticsSnapshot,
  formatRelativeTimestamp,
  formatVitalValue,
  getLatestVitalSample,
  getProfileDetails,
  getProfileHeadline,
  modeLabelForVitals,
  ratingLabel,
  refreshDbHealth,
  requestSwHealth,
  restoreBackup,
  triggerRollback,
  useDiagnosticsStore
} from '@/features/diagnostics/runtimeDiagnostics';
import { useUiText } from '@/hooks/useUiText';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';

const vitalOrder = ['cls', 'fcp', 'lcp', 'ttfb'] as const;

export function DiagnosticsShell() {
  const t = useUiText();
  const closeDiagnostics = useWorkspaceStore((state) => state.closeDiagnostics);
  const isOpen = useWorkspaceStore((state) => state.isDiagnosticsOpen);
  const {
    backups,
    backupsError,
    dbHealth,
    dbHealthError,
    dbHealthLoading,
    diagnosticsLog,
    profileReport,
    rollbackInFlight,
    serviceWorkerHealth,
    tabRole,
    webVitalsActive,
    webVitalsLog,
    webVitalsManualOverride,
    webVitalsSamples
  } = useDiagnosticsStore();

  const totalRecords = dbHealth
    ? Object.values(dbHealth.tables).reduce((sum, value) => sum + (value ?? 0), 0)
    : 0;
  const dbSummary = dbHealthLoading
    ? 'Sprawdzam Dexie…'
    : dbHealthError
      ? `Błąd zdrowia DB: ${dbHealthError}`
      : dbHealth
        ? `Łącznie ${totalRecords} rekordów (backupów: ${dbHealth.backups}). Ostatni audit: ${
            dbHealth.lastAudit ? formatRelativeTimestamp(dbHealth.lastAudit) : 'brak audytów'
          }.`
        : 'Brak danych o DB.';
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeDiagnostics();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, closeDiagnostics]);

  const latestSample = getLatestVitalSample();
  const webVitalsSummary = webVitalsActive
    ? latestSample
      ? `Ostatnia aktualizacja ${new Date(latestSample.at).toLocaleTimeString('pl-PL')}.`
      : 'Sampler aktywny – brak danych.'
    : 'Sampler nieaktywny.';

  return (
    <>
      <aside
        ref={panelRef}
        id="diagnostics-panel"
        className={`${isOpen ? 'absolute' : 'hidden'} right-4 top-16 z-[125] w-80 rounded-2xl border border-border bg-background p-4 shadow-2xl`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide">Diagnostics</h2>
          <button
            id="sw-toggle-diagnostics"
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border text-text-secondary transition hover:bg-surface hover:text-text-primary"
            aria-label="Zamknij"
            onClick={closeDiagnostics}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 max-h-[calc(100vh-12rem)] overflow-y-auto space-y-2 pr-0.5 text-xs text-text-secondary">
          <div className="rounded-lg border border-border/50 p-2.5 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              Runtime
            </p>
            <div id="profile-banner" aria-live="polite" data-profile={profileReport?.profile}>
              <div id="profile-banner-headline" className="font-semibold text-text-primary">
                {profileReport
                  ? getProfileHeadline(profileReport.profile)
                  : 'Profil runtime niedostępny'}
              </div>
              <div id="profile-banner-details">
                {profileReport
                  ? getProfileDetails(profileReport, serviceWorkerHealth, tabRole)
                  : 'Brak danych profilu runtime.'}
              </div>
            </div>
            <div id="network-banner" aria-live="polite">
              <div id="network-banner-text" />
            </div>
          </div>

          <div className="rounded-lg border border-border/50 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
              Service Worker
            </p>
            <div id="sw-diagnostics" className="space-y-0.5">
              <div id="sw-diag-version">
                SW: {serviceWorkerHealth ? `v${serviceWorkerHealth.swVersion}` : '–'}
              </div>
              <div id="sw-diag-cache">Cache: {serviceWorkerHealth?.cacheName || '–'}</div>
              <div id="sw-diag-entries">
                Pliki: {serviceWorkerHealth ? serviceWorkerHealth.cachedEntries : '–'}
              </div>
              <div id="sw-diag-profile">Profil: {serviceWorkerHealth?.profile?.profile || '–'}</div>
              <div
                id="sw-diag-backup"
                data-status={serviceWorkerHealth?.backupAvailable ? 'ok' : 'warn'}
              >
                Backup:{' '}
                {serviceWorkerHealth ? (serviceWorkerHealth.backupAvailable ? 'TAK' : 'NIE') : '–'}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/50 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
              Database
            </p>
            <div id="db-health-summary" className="mb-1">
              {dbSummary}
            </div>
            <div className="space-y-0.5">
              <div id="db-health-version">DB: {dbHealth ? `v${dbHealth.version}` : 'v–'}</div>
              <div id="db-health-backups">Backupy: {dbHealth ? dbHealth.backups : '–'}</div>
              <div id="db-health-lastAudit">
                Ostatni audit:{' '}
                {dbHealth?.lastAudit ? formatRelativeTimestamp(dbHealth.lastAudit) : '–'}
              </div>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5">
              <div id="db-health-settings">settings: {dbHealth?.tables.settings ?? '–'}</div>
              <div id="db-health-files">files: {dbHealth?.tables.files ?? '–'}</div>
              <div id="db-health-audit">audit: {dbHealth?.tables.audit ?? '–'}</div>
              <div id="db-health-uiState">uiState: {dbHealth?.tables.uiState ?? '–'}</div>
              <div id="db-health-ldcSettings">
                ldcSettings: {dbHealth?.tables.ldcSettings ?? '–'}
              </div>
              <div id="db-health-ldcMappings">
                ldcMappings: {dbHealth?.tables.ldcMappings ?? '–'}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/50 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
              Backups
            </p>
            <div id="db-backup-list" className="space-y-1.5">
              {backupsError ? (
                <div>{backupsError}</div>
              ) : backups.length === 0 ? (
                <div>Brak kopii zapasowych Dexie.</div>
              ) : (
                backups.map((backup) => (
                  <div
                    key={backup.id ?? backup.createdAt}
                    className="flex items-center justify-between gap-2 rounded-lg bg-surface/70 px-2.5 py-1.5"
                  >
                    <span className="min-w-0 truncate">
                      {backup.label
                        ? `${backup.label} (${new Date(backup.createdAt).toLocaleString('pl-PL')})`
                        : `Backup #${backup.id} (${new Date(backup.createdAt).toLocaleString('pl-PL')})`}
                    </span>
                    <button
                      type="button"
                      className="shrink-0 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={tabRole !== 'primary'}
                      onClick={() => {
                        void restoreBackup(backup);
                      }}
                    >
                      Przywróć
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border/50 p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted mb-1.5">
              Log
            </p>
            <div
              id="sw-diagnostics-log"
              className="rounded-lg bg-surface/70 p-2.5 whitespace-pre-line leading-relaxed"
            >
              {diagnosticsLog.length > 0
                ? diagnosticsLog.join('\n')
                : 'Brak logów diagnostycznych.'}
            </div>
          </div>

          <div
            id="web-vitals-panel"
            className="rounded-lg border border-border/50 p-2.5 space-y-1.5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
              Web Vitals
            </p>
            <div id="web-vitals-status">
              {webVitalsActive
                ? `Sampler aktywny (${modeLabelForVitals(webVitalsManualOverride)})`
                : `Sampler nieaktywny (${modeLabelForVitals(webVitalsManualOverride)})`}
            </div>
            <div id="web-vitals-summary">{webVitalsSummary}</div>
            <div className="space-y-0.5">
              {vitalOrder.map((name) => {
                const sample = webVitalsSamples[name];
                return (
                  <div key={name} className="grid grid-cols-2 gap-2">
                    <div id={`vital-${name}-rating`} data-rating={sample?.rating || 'unknown'}>
                      {name.toUpperCase()}: {sample ? ratingLabel(sample.rating) : '–'}
                    </div>
                    <div id={`vital-${name}-value`}>{sample ? formatVitalValue(sample) : '–'}</div>
                  </div>
                );
              })}
            </div>
            <div
              id="web-vitals-log"
              className="rounded-lg bg-surface/70 p-2.5 whitespace-pre-line leading-relaxed"
            >
              {webVitalsLog.length > 0
                ? webVitalsLog.join('\n')
                : webVitalsActive
                  ? 'Sampler zbiera dane…'
                  : 'Brak logów Web Vitals.'}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            id="sw-refresh-health"
            type="button"
            className="rounded-xl border border-border px-3 py-2 text-xs font-semibold transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              requestSwHealth();
            }}
          >
            Refresh SW
          </button>
          <button
            id="sw-apply-update"
            type="button"
            className="rounded-xl border border-border px-3 py-2 text-xs font-semibold transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              void applyServiceWorkerUpdate();
            }}
          >
            {t('sw_apply_update')}
          </button>
          <button
            id="sw-trigger-rollback"
            type="button"
            className="rounded-xl border border-border px-3 py-2 text-xs font-semibold transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            disabled={rollbackInFlight}
            onClick={() => {
              void triggerRollback();
            }}
          >
            Rollback
          </button>
          <button
            id="db-refresh-health"
            type="button"
            className="rounded-xl border border-border px-3 py-2 text-xs font-semibold transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            disabled={dbHealthLoading}
            onClick={() => {
              void refreshDbHealth(true);
            }}
          >
            Refresh DB
          </button>
          <button
            id="db-create-backup"
            type="button"
            className="rounded-xl border border-border px-3 py-2 text-xs font-semibold transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              void createBackup();
            }}
          >
            Backup
          </button>
          <button
            id="web-vitals-toggle"
            type="button"
            className="rounded-xl border border-border px-3 py-2 text-xs font-semibold transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            disabled={tabRole !== 'primary'}
            onClick={() => {
              cycleWebVitalsMode();
            }}
          >
            Tryb: {modeLabelForVitals(webVitalsManualOverride).toUpperCase()}
          </button>
          <button
            id="copy-diagnostics"
            type="button"
            className="rounded-xl border border-border px-3 py-2 text-xs font-semibold transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              void copyDiagnosticsSnapshot(buildDiagnosticsSnapshot());
            }}
          >
            Copy
          </button>
          <button
            id="export-diagnostics"
            type="button"
            className="rounded-xl border border-border px-3 py-2 text-xs font-semibold transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => {
              exportDiagnosticsSnapshot(buildDiagnosticsSnapshot());
            }}
          >
            Export
          </button>
        </div>
      </aside>
    </>
  );
}
