import { create } from 'zustand';

import {
  addAudit,
  createDbBackup,
  getDbHealth,
  listDbBackups,
  restoreDbBackup,
  subscribeToDbEvents,
  type BackupRecord,
  type DbHealthReport
} from '@/storage/db';
import { clearAllState } from '@/storage/state';
import { startWebVitalsSampler, type VitalName, type VitalSample } from '@/telemetry/webVitals';

import { attachServiceWorkerLifecycle } from './serviceWorkerLifecycle';
import { whenDocumentLoaded } from './whenDocumentLoaded';

export type ProfileName = 'full' | 'lite' | 'ts-only';
export type TabRole = 'primary' | 'secondary';
export type WebVitalsMode = 'force-off' | 'force-on' | 'none';

export interface ProfileReport {
  crossOriginIsolated: boolean;
  effectiveType?: string;
  hasIndexedDb: boolean;
  lowHardware: boolean;
  profile: ProfileName;
  reasons: string[];
  saveData: boolean;
}

export interface SwHealthPayload {
  backupAvailable: boolean;
  cachedEntries: number;
  cacheName: string;
  profile?: null | ProfileReport;
  swVersion: string;
}

interface DiagnosticsState {
  backups: BackupRecord[];
  backupsError: null | string;
  dbHealth: DbHealthReport | null;
  dbHealthError: null | string;
  dbHealthLoading: boolean;
  diagnosticsLog: string[];
  profileReport: null | ProfileReport;
  rollbackInFlight: boolean;
  serviceWorkerHealth: null | SwHealthPayload;
  tabRole: TabRole;
  webVitalsActive: boolean;
  webVitalsLog: string[];
  webVitalsManualOverride: WebVitalsMode;
  webVitalsSamples: Partial<Record<VitalName, VitalSample>>;
}

const DB_HEALTH_EVENT_NAMES = new Set([
  'audit.added',
  'db.cleared',
  'files.updated',
  'ldc.mappings.updated',
  'ldc.settings.updated',
  'settings.updated',
  'uiState.updated'
]);
const DB_HEALTH_EVENT_PREFIXES = ['backup.'];
const MAX_DIAGNOSTICS_LOG_LINES = 12;
const MAX_WEB_VITALS_LOG_LINES = 6;

let unsubscribeDbEvents: (() => void) | null = null;
let dbHealthRefreshTimeout: null | number = null;
let webVitalsSamplerStop: (() => void) | null = null;

function formatLogLine(message: string) {
  const timestamp = new Date().toLocaleTimeString('pl-PL', { hour12: false });
  return `[${timestamp}] ${message}`;
}

function loadWebVitalsPreference(): WebVitalsMode {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 'none';
    const value = window.localStorage.getItem('fm.webVitalsMode');
    if (value === 'force-off' || value === 'force-on' || value === 'none') {
      return value;
    }
  } catch (error) {
    console.warn('[WebVitals] load pref failed', error);
  }
  return 'none';
}

function saveWebVitalsPreference(mode: WebVitalsMode) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem('fm.webVitalsMode', mode);
  } catch (error) {
    console.warn('[WebVitals] save pref failed', error);
  }
}

function createInitialState(): DiagnosticsState {
  return {
    backups: [],
    backupsError: null,
    dbHealth: null,
    dbHealthError: null,
    dbHealthLoading: false,
    diagnosticsLog: [],
    profileReport: null,
    rollbackInFlight: false,
    serviceWorkerHealth: null,
    tabRole: 'primary',
    webVitalsActive: false,
    webVitalsLog: [],
    webVitalsManualOverride: loadWebVitalsPreference(),
    webVitalsSamples: {}
  };
}

export const useDiagnosticsStore = create<DiagnosticsState>(() => createInitialState());

export function resetDiagnosticsStore() {
  useDiagnosticsStore.setState(createInitialState());
}

export function appendDiagnosticsLog(message: string) {
  useDiagnosticsStore.setState((state) => ({
    diagnosticsLog: [formatLogLine(message), ...state.diagnosticsLog].slice(
      0,
      MAX_DIAGNOSTICS_LOG_LINES
    )
  }));
}

export function appendWebVitalsLog(message: string) {
  useDiagnosticsStore.setState((state) => ({
    webVitalsLog: [formatLogLine(message), ...state.webVitalsLog].slice(0, MAX_WEB_VITALS_LOG_LINES)
  }));
}

export function buildDiagnosticsSnapshot() {
  const state = useDiagnosticsStore.getState();
  const profile = state.profileReport
    ? {
        crossOriginIsolated: state.profileReport.crossOriginIsolated,
        effectiveType: state.profileReport.effectiveType,
        hasIndexedDb: state.profileReport.hasIndexedDb,
        lowHardware: state.profileReport.lowHardware,
        profile: state.profileReport.profile,
        reasons: state.profileReport.reasons,
        saveData: state.profileReport.saveData
      }
    : null;
  const sw = state.serviceWorkerHealth
    ? {
        backupAvailable: state.serviceWorkerHealth.backupAvailable,
        cachedEntries: state.serviceWorkerHealth.cachedEntries,
        cacheName: state.serviceWorkerHealth.cacheName,
        profile: state.serviceWorkerHealth.profile?.profile,
        version: state.serviceWorkerHealth.swVersion
      }
    : null;
  const db = state.dbHealth
    ? {
        backups: state.dbHealth.backups,
        lastAudit: state.dbHealth.lastAudit,
        tables: state.dbHealth.tables,
        version: state.dbHealth.version
      }
    : null;
  const vitals = Object.entries(state.webVitalsSamples).reduce<Record<string, VitalSample>>(
    (acc, [name, sample]) => {
      if (sample) acc[name] = sample;
      return acc;
    },
    {}
  );

  return {
    clipboardMeta: {
      hasClipboardApi: typeof navigator !== 'undefined' && !!navigator.clipboard,
      userAgent: navigator.userAgent
    },
    dexie: db,
    profile,
    serviceWorker: sw,
    tabRole: state.tabRole,
    timestamp: Date.now(),
    webVitals: vitals,
    webVitalsLog: [...state.webVitalsLog]
  };
}

export async function copyDiagnosticsSnapshot(snapshot = buildDiagnosticsSnapshot()) {
  const payload = JSON.stringify(snapshot, null, 2);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(payload);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = payload;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.append(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  textarea.remove();
  if (!ok) {
    throw new Error('Document.execCommand("copy") zwrócił false');
  }
}

export function exportDiagnosticsSnapshot(snapshot = buildDiagnosticsSnapshot()) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fm-diagnostics-${new Date(snapshot.timestamp).toISOString()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function formatRelativeTimestamp(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'przed chwilą';
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h temu`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'wczoraj';
  if (days < 7) return `${days} dni temu`;
  return new Date(timestamp).toLocaleString('pl-PL');
}

export function formatVitalValue(sample: VitalSample) {
  if (sample.unit === 'ms') {
    if (sample.value >= 1000) {
      return `${(sample.value / 1000).toFixed(2)} s`;
    }
    return `${Math.round(sample.value)} ms`;
  }
  return sample.value.toString();
}

export function ratingLabel(rating: VitalSample['rating']) {
  switch (rating) {
    case 'good': {
      return 'Dobra';
    }
    case 'needs-improvement': {
      return 'Do poprawy';
    }
    case 'poor': {
      return 'Słaba';
    }
    default: {
      return 'Nieznana';
    }
  }
}

export function modeLabelForVitals(mode = useDiagnosticsStore.getState().webVitalsManualOverride) {
  switch (mode) {
    case 'force-off': {
      return 'manual off';
    }
    case 'force-on': {
      return 'manual on';
    }
    case 'none': {
      return 'auto';
    }
  }
}

export function getLatestVitalSample() {
  let latest: null | VitalSample = null;
  Object.values(useDiagnosticsStore.getState().webVitalsSamples).forEach((sample) => {
    if (!sample) return;
    if (!latest || sample.at > latest.at) {
      latest = sample;
    }
  });
  return latest;
}

export function getProfileHeadline(profile: ProfileName) {
  const headlineCopy: Record<ProfileName, string> = {
    full: 'Profil FULL – wszystkie funkcje aktywne',
    lite: 'Profil LITE – optymalizacja zasobów',
    'ts-only': 'Profil TS-ONLY – fallback bez Pyodide/OCR'
  };
  return headlineCopy[profile];
}

export function getProfileDetails(
  report: ProfileReport,
  swHealth: null | SwHealthPayload,
  tabRole: TabRole
) {
  const detailCopy: Record<ProfileName, string> = {
    full: 'Pyodide/OCR, Dexie i workers działają w pełnej prędkości.',
    lite: 'Ciężkie wizualizacje i preloady są ograniczone, aby chronić zasoby.',
    'ts-only': 'Parser pracuje w głównym wątku, Dexie/Pyodide/OCR są wyłączone.'
  };
  const reasonsText = report.reasons.length > 0 ? ` Powód: ${report.reasons.join(' ')}` : '';
  const swText = swHealth
    ? ` SW v${swHealth.swVersion} (${swHealth.cachedEntries} plików cache, backup ${
        swHealth.backupAvailable ? 'TAK' : 'NIE'
      }) – karta ${tabRole.toUpperCase()}.`
    : '';
  return `${detailCopy[report.profile]}${reasonsText} ${swText}`.trim();
}

export function getCurrentProfileReport() {
  return useDiagnosticsStore.getState().profileReport;
}

function setProfileReport(report: ProfileReport) {
  useDiagnosticsStore.setState({ profileReport: report });
}

function setTabRole(role: TabRole) {
  useDiagnosticsStore.setState({ tabRole: role });
}

function setServiceWorkerHealth(payload: null | SwHealthPayload) {
  useDiagnosticsStore.setState({ serviceWorkerHealth: payload });
}

function setDbHealthState(
  partial: Pick<DiagnosticsState, 'dbHealth' | 'dbHealthError' | 'dbHealthLoading'>
) {
  useDiagnosticsStore.setState(partial);
}

function setBackups(backups: BackupRecord[], backupsError: null | string) {
  useDiagnosticsStore.setState({ backups, backupsError });
}

function setRollbackInFlight(rollbackInFlight: boolean) {
  useDiagnosticsStore.setState({ rollbackInFlight });
}

function setWebVitalsMode(mode: WebVitalsMode) {
  saveWebVitalsPreference(mode);
  useDiagnosticsStore.setState({ webVitalsManualOverride: mode });
}

function setWebVitalsActive(webVitalsActive: boolean) {
  useDiagnosticsStore.setState({ webVitalsActive });
}

function setVitalSample(sample: VitalSample) {
  useDiagnosticsStore.setState((state) => ({
    webVitalsSamples: {
      ...state.webVitalsSamples,
      [sample.name]: sample
    }
  }));
}

function detectProfile(): ProfileReport {
  const structuralReasons: string[] = [];
  const perfReasons: string[] = [];
  const crossOrigin = (window as any).crossOriginIsolated === true;
  const hasIndexedDb = typeof indexedDB !== 'undefined';
  const connection = (navigator as any).connection as
    | undefined
    | {
        addEventListener?: (type: string, callback: () => void) => void;
        effectiveType?: string;
        saveData?: boolean;
      };
  const saveData = connection?.saveData === true;
  const effectiveType = connection?.effectiveType;
  const slowConnection = effectiveType ? ['2g', 'slow-2g'].includes(effectiveType) : false;
  const lowHardware =
    typeof navigator.hardwareConcurrency === 'number' &&
    navigator.hardwareConcurrency > 0 &&
    navigator.hardwareConcurrency <= 2;

  if (!crossOrigin) {
    structuralReasons.push('Brak COOP/COEP – SharedArrayBuffer oraz Pyodide/OCR wyłączone.');
  }
  if (!hasIndexedDb) {
    structuralReasons.push('IndexedDB niedostępne – Dexie, cache i Hard Reset są ograniczone.');
  }
  if (saveData) {
    perfReasons.push('Tryb oszczędzania danych – ograniczam preload i wizualizacje.');
  }
  if (slowConnection) {
    perfReasons.push('Wolne łącze – pomijam ciężkie pobrania.');
  }
  if (lowHardware) {
    perfReasons.push('Niskie zasoby CPU – zmniejszam pule workerów.');
  }

  let profile: ProfileName;
  let reasons: string[] = [];

  if (!crossOrigin || !hasIndexedDb) {
    profile = 'ts-only';
    reasons = structuralReasons.concat(perfReasons);
  } else if (perfReasons.length > 0) {
    profile = 'lite';
    reasons = perfReasons;
  } else {
    profile = 'full';
  }

  return {
    crossOriginIsolated: crossOrigin,
    effectiveType,
    hasIndexedDb,
    lowHardware,
    profile,
    reasons,
    saveData
  };
}

function postToServiceWorker(message: any) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready
    .then((registration) => {
      const target = registration.active || navigator.serviceWorker.controller;
      target?.postMessage(message);
    })
    .catch((error: unknown) => {
      console.warn('[ServiceWorker] postMessage failed', error);
    });
}

function postProfileReport(report: ProfileReport) {
  postToServiceWorker({
    report,
    type: 'PROFILE_REPORT'
  });
}

export function requestSwHealth() {
  postToServiceWorker({ type: 'REQUEST_SW_HEALTH' });
}

export async function refreshBackupList() {
  try {
    const backups = await listDbBackups(5);
    setBackups(backups, null);
  } catch (error) {
    setBackups([], `Nie udało się wczytać backupów: ${error}`);
  }
}

export async function restoreBackup(record: BackupRecord) {
  if (useDiagnosticsStore.getState().tabRole !== 'primary') return;
  try {
    appendDiagnosticsLog(`Przywracam backup #${record.id}…`);
    await restoreDbBackup(record);
    appendDiagnosticsLog(`Przywrócono backup #${record.id}.`);
    await refreshBackupList();
    await refreshDbHealth(true);
  } catch (error) {
    appendDiagnosticsLog(`Przywrócenie backupu nie powiodło się: ${error}`);
  }
}

export async function createBackup() {
  try {
    appendDiagnosticsLog('Ładuję backup Dexie…');
    const record = await createDbBackup();
    appendDiagnosticsLog(`Backup #${record.id} zapisany.`);
    await refreshBackupList();
    await refreshDbHealth(true);
  } catch (error) {
    appendDiagnosticsLog(`Backup nie powiódł się: ${error}`);
  }
}

export async function refreshDbHealth(force = false) {
  const state = useDiagnosticsStore.getState();
  if (state.dbHealthLoading && !force) {
    return;
  }

  setDbHealthState({
    dbHealth: state.dbHealth,
    dbHealthError: state.dbHealthError,
    dbHealthLoading: true
  });

  try {
    const report = await getDbHealth();
    setDbHealthState({
      dbHealth: report,
      dbHealthError: null,
      dbHealthLoading: false
    });
  } catch (error) {
    setDbHealthState({
      dbHealth: state.dbHealth,
      dbHealthError: error instanceof Error ? error.message : String(error),
      dbHealthLoading: false
    });
  }
}

function scheduleDbHealthRefresh(delay = 1000) {
  if (dbHealthRefreshTimeout) {
    window.clearTimeout(dbHealthRefreshTimeout);
  }
  dbHealthRefreshTimeout = window.setTimeout(() => {
    dbHealthRefreshTimeout = null;
    void refreshDbHealth();
  }, delay);
}

function setupDbEventSubscription() {
  if (unsubscribeDbEvents) {
    unsubscribeDbEvents();
    unsubscribeDbEvents = null;
  }
  unsubscribeDbEvents = subscribeToDbEvents((payload) => {
    if (!payload?.event) return;
    if (payload.event.startsWith('backup.')) {
      void refreshBackupList();
    }
    if (
      DB_HEALTH_EVENT_NAMES.has(payload.event) ||
      DB_HEALTH_EVENT_PREFIXES.some((prefix) => payload.event.startsWith(prefix))
    ) {
      scheduleDbHealthRefresh();
    }
  });
}

function shouldAutoSampleVitals() {
  const state = useDiagnosticsStore.getState();
  const report = state.profileReport;
  if (!report) return false;
  if (state.tabRole !== 'primary') return false;
  if (report.profile !== 'full') return false;
  if (!report.crossOriginIsolated || !report.hasIndexedDb) return false;
  if (report.saveData) return false;
  const slowConnection = report.effectiveType
    ? ['2g', '3g', 'slow-2g'].includes(report.effectiveType)
    : false;
  return !slowConnection;
}

function maybeStartWebVitalsAuto() {
  if (!shouldAutoSampleVitals()) {
    if (useDiagnosticsStore.getState().webVitalsActive) {
      stopWebVitalsSampler();
    }
    return;
  }

  if (!useDiagnosticsStore.getState().webVitalsActive) {
    startWebVitalsSamplerUi();
  }
}

function startWebVitalsSamplerUi() {
  if (webVitalsSamplerStop) return true;
  if (useDiagnosticsStore.getState().tabRole !== 'primary') return false;
  if (typeof startWebVitalsSampler !== 'function') return false;
  webVitalsSamplerStop = startWebVitalsSampler((sample) => {
    setVitalSample(sample);
    appendWebVitalsLog(
      `${sample.name.toUpperCase()}: ${formatVitalValue(sample)} (${ratingLabel(sample.rating)})`
    );
  });
  setWebVitalsActive(true);
  appendWebVitalsLog('Sampler uruchomiony.');
  return true;
}

function stopWebVitalsSampler() {
  if (webVitalsSamplerStop) {
    webVitalsSamplerStop();
    webVitalsSamplerStop = null;
  }
  setWebVitalsActive(false);
  appendWebVitalsLog('Sampler zatrzymany.');
}

function syncWebVitalsState() {
  const state = useDiagnosticsStore.getState();
  if (state.tabRole !== 'primary') {
    if (state.webVitalsActive) stopWebVitalsSampler();
    return;
  }
  if (state.webVitalsManualOverride === 'force-on') {
    if (!state.webVitalsActive) startWebVitalsSamplerUi();
    return;
  }
  if (state.webVitalsManualOverride === 'force-off') {
    if (state.webVitalsActive) stopWebVitalsSampler();
    return;
  }
  maybeStartWebVitalsAuto();
}

export function cycleWebVitalsMode() {
  const currentMode = useDiagnosticsStore.getState().webVitalsManualOverride;
  const nextMode: WebVitalsMode =
    currentMode === 'none' ? 'force-on' : currentMode === 'force-on' ? 'force-off' : 'none';
  setWebVitalsMode(nextMode);

  switch (nextMode) {
    case 'force-off': {
      appendDiagnosticsLog('Web Vitals – tryb MANUAL OFF.');
      appendWebVitalsLog('Tryb zmieniony na MANUAL OFF (zatrzymanie).');
      break;
    }
    case 'force-on': {
      appendDiagnosticsLog('Web Vitals – tryb MANUAL ON.');
      appendWebVitalsLog('Tryb zmieniony na MANUAL ON (wymuszone uruchomienie).');
      break;
    }
    case 'none': {
      appendDiagnosticsLog('Web Vitals – tryb AUTO.');
      appendWebVitalsLog('Tryb zmieniony na AUTO.');
      break;
    }
  }

  syncWebVitalsState();
}

function updateTabRole() {
  const isVisible = document.visibilityState === 'visible';
  const hasFocus = document.hasFocus();
  const nextRole: TabRole = isVisible && hasFocus ? 'primary' : 'secondary';
  if (nextRole === useDiagnosticsStore.getState().tabRole) return;
  setTabRole(nextRole);
  document.documentElement.dataset.tabRole = nextRole;
  if (document.body) document.body.dataset.tabRole = nextRole;
  if (nextRole !== 'primary') {
    stopWebVitalsSampler();
  }
  syncWebVitalsState();
  appendDiagnosticsLog(`Karta ustawiła rolę: ${nextRole.toUpperCase()}.`);
}

function setupTabRoleListeners() {
  updateTabRole();
  window.addEventListener('focus', updateTabRole);
  window.addEventListener('blur', updateTabRole);
  document.addEventListener('visibilitychange', updateTabRole);
}

function setupServiceWorkerMessaging() {
  if (!navigator.serviceWorker) return;
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    switch (data.type) {
      case 'SW_HEALTH_RESPONSE': {
        setServiceWorkerHealth(data.payload || null);
        break;
      }
      case 'SW_ROLLBACK_RESULT': {
        setRollbackInFlight(false);
        if (data.ok) {
          requestSwHealth();
          appendDiagnosticsLog('Przywrócono poprzedni cache.');
        } else {
          appendDiagnosticsLog(data.message || 'Nie udało się przywrócić cache.');
        }
        break;
      }
      default: {
        break;
      }
    }
  });
}

function registerServiceWorker() {
  if (import.meta.env?.DEV) {
    return;
  }
  if (!('serviceWorker' in navigator)) return;
  if (!(location.protocol === 'https:' || location.hostname === 'localhost')) return;

  whenDocumentLoaded(() => {
    navigator.serviceWorker
      .register('/service-worker.js', { scope: '/' })
      .then((reg) => {
        console.log('[ServiceWorker] Registered', reg.scope);

        // No automatic activation or reload: see attachServiceWorkerLifecycle.
        navigator.serviceWorker.ready.then(() => {
          requestSwHealth();
        });
      })
      .catch((error: unknown) => console.error('[ServiceWorker] Registration failed', error));
  });
}

/** User action: activate a waiting service worker update and reload once it controls the page. */
export async function applyServiceWorkerUpdate(): Promise<boolean> {
  if (!navigator.serviceWorker) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;
  await registration.update();
  const applied = attachServiceWorkerLifecycle({
    container: navigator.serviceWorker,
    registration,
    reload: () => window.location.reload()
  }).applyUpdate();
  appendDiagnosticsLog(
    applied ? 'Aktywuję nową wersję aplikacji…' : 'Brak oczekującej aktualizacji.'
  );
  return applied;
}

export async function triggerRollback() {
  if (useDiagnosticsStore.getState().rollbackInFlight) return;
  setRollbackInFlight(true);
  appendDiagnosticsLog('Przywracam poprzedni cache…');
  postToServiceWorker({ type: 'REQUEST_SW_ROLLBACK' });
}

export async function runHardReset() {
  const confirmed = window.confirm('Hard Reset wyczyści cache i Service Worker. Kontynuować?');
  if (!confirmed) return;

  try {
    console.log('[HardReset] Starting reset sequence...');
    await addAudit('hard_reset_triggered', { reason: 'user' }, 'warn');

    if (window.caches && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('fm-evaluator-')).map((k) => caches.delete(k))
      );
    }

    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }

    if ((window as any).clearAllDb) {
      await (window as any).clearAllDb();
    }

    await clearAllState();
    await addAudit('hard_reset_completed', {}, 'info');

    console.log('[HardReset] Reset completed successfully.');
  } catch (error) {
    console.error('[HardReset] Failed', error);
    await addAudit('hard_reset_failed', { error: String(error) }, 'error');
  } finally {
    window.location.reload();
  }
}

export function initializeDiagnosticsRuntime(options?: {
  onProfileChange?: (report: ProfileReport) => void;
}) {
  const applyProfile = () => {
    const report = detectProfile();
    setProfileReport(report);
    postProfileReport(report);
    options?.onProfileChange?.(report);
    syncWebVitalsState();
  };

  applyProfile();
  setupServiceWorkerMessaging();
  setupTabRoleListeners();
  setupDbEventSubscription();
  registerServiceWorker();
  void refreshBackupList();
  void refreshDbHealth();

  const connection = (navigator as any).connection as
    | undefined
    | { addEventListener?: (type: string, callback: () => void) => void };
  if (connection && typeof connection.addEventListener === 'function') {
    connection.addEventListener('change', applyProfile);
  }
}
