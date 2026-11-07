/**
 * Health Check UI - Startup diagnostics for app capabilities
 * Shows what features are available/disabled based on environment
 */

import { type FeatureName, getFeatureFlags } from '../config/featureFlags';

export interface HealthCheckConfig {
  autoDismissDelay?: number;
  autoDismissOk?: boolean;
  onComplete?: (report: HealthCheckReport) => void;
  showOnDegraded?: boolean;
  showOnUnavailable?: boolean;
}

export interface HealthCheckItem {
  critical?: boolean;
  description: string;
  id: string;
  message?: string;
  name: string;
  status: HealthCheckStatus;
}

export interface HealthCheckReport {
  duration: number;
  items: HealthCheckItem[];
  overall: HealthCheckStatus;
  profile: 'full' | 'lite' | 'ts-only';
  timestamp: number;
}

export type HealthCheckStatus = 'checking' | 'degraded' | 'ok' | 'unavailable';

const DEFAULT_CONFIG: HealthCheckConfig = {
  autoDismissDelay: 2000,
  autoDismissOk: true,
  showOnDegraded: true,
  showOnUnavailable: true
};

export function renderHealthCheckReport(report: HealthCheckReport, container: HTMLElement): void {
  container.innerHTML = '';
  container.className = 'health-check-report';
  container.dataset.overall = report.overall;

  const header = document.createElement('div');
  header.className = 'health-check-header';

  const statusIcon = document.createElement('span');
  statusIcon.className = 'health-check-icon';
  statusIcon.textContent =
    report.overall === 'ok' ? '✓' : report.overall === 'degraded' ? '!' : '✗';

  const title = document.createElement('span');
  title.className = 'health-check-title';
  title.textContent = `Health Check (${report.profile.toUpperCase()})`;

  header.append(statusIcon);
  header.append(title);
  container.append(header);

  const list = document.createElement('ul');
  list.className = 'health-check-list';

  for (const item of report.items) {
    const li = document.createElement('li');
    li.className = 'health-check-item';
    li.dataset.status = item.status;

    const icon = document.createElement('span');
    icon.className = 'health-item-icon';
    icon.textContent = item.status === 'ok' ? '✓' : item.status === 'degraded' ? '!' : '✗';

    const content = document.createElement('div');
    content.className = 'health-item-content';

    const name = document.createElement('strong');
    name.textContent = item.name;

    const message = document.createElement('span');
    message.className = 'health-item-message';
    message.textContent = item.message || item.description;

    content.append(name);
    content.append(message);

    li.append(icon);
    li.append(content);
    list.append(li);
  }

  container.append(list);

  const footer = document.createElement('div');
  footer.className = 'health-check-footer';
  footer.textContent = `Sprawdzono w ${Math.round(report.duration)}ms`;
  container.append(footer);
}

export async function runHealthCheck(): Promise<HealthCheckReport> {
  const startTime = performance.now();
  const flags = getFeatureFlags();

  const checks = await Promise.all([
    checkCrossOriginIsolated(),
    checkIndexedDb(),
    checkServiceWorker(),
    checkOcrModels(),
    checkWebWorkers(),
    checkStorage(),
    checkNetwork()
  ]);

  const duration = performance.now() - startTime;

  // Determine overall status
  let overall: HealthCheckStatus = 'ok';
  const hasCriticalUnavailable = checks.some((c) => c.critical && c.status === 'unavailable');
  const hasUnavailable = checks.some((c) => c.status === 'unavailable');
  const hasDegraded = checks.some((c) => c.status === 'degraded');

  if (hasCriticalUnavailable) {
    overall = 'unavailable';
  } else if (hasUnavailable || hasDegraded) {
    overall = 'degraded';
  }

  return {
    duration,
    items: checks,
    overall,
    profile: flags.getProfile(),
    timestamp: Date.now()
  };
}

async function checkCrossOriginIsolated(): Promise<HealthCheckItem> {
  const isolated = typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
  return {
    critical: false,
    description: 'Cross-Origin Isolation dla SharedArrayBuffer',
    id: 'coop-coep',
    message: isolated ? 'SharedArrayBuffer dostępny' : 'Brak izolacji – Pyodide/OCR niedostępne',
    name: 'COOP/COEP',
    status: isolated ? 'ok' : 'unavailable'
  };
}

async function checkIndexedDb(): Promise<HealthCheckItem> {
  const hasIdb = typeof indexedDB !== 'undefined';
  if (!hasIdb) {
    return {
      critical: true,
      description: 'Lokalna baza danych',
      id: 'indexeddb',
      message: 'IndexedDB niedostępne – dane nie będą zapisywane',
      name: 'IndexedDB',
      status: 'unavailable'
    };
  }

  try {
    const testDb = indexedDB.open('__fm_health_check__', 1);
    await new Promise<void>((resolve, reject) => {
      testDb.onerror = () => reject(testDb.error);
      testDb.onsuccess = () => {
        testDb.result.close();
        indexedDB.deleteDatabase('__fm_health_check__');
        resolve();
      };
    });
    return {
      description: 'Lokalna baza danych',
      id: 'indexeddb',
      message: 'Dexie gotowe do użycia',
      name: 'IndexedDB',
      status: 'ok'
    };
  } catch (error) {
    return {
      critical: true,
      description: 'Lokalna baza danych',
      id: 'indexeddb',
      message: `Ograniczona funkcjonalność: ${error}`,
      name: 'IndexedDB',
      status: 'degraded'
    };
  }
}

async function checkNetwork(): Promise<HealthCheckItem> {
  const online = navigator.onLine;
  const connection = (navigator as any).connection;
  const saveData = connection?.saveData === true;
  const effectiveType = connection?.effectiveType;

  if (!online) {
    return {
      description: 'Połączenie internetowe',
      id: 'network',
      message: 'Tryb offline',
      name: 'Sieć',
      status: 'unavailable'
    };
  }

  if (saveData) {
    return {
      description: 'Połączenie internetowe',
      id: 'network',
      message: 'Tryb oszczędzania danych – ograniczone funkcje',
      name: 'Sieć',
      status: 'degraded'
    };
  }

  if (effectiveType && ['2g', 'slow-2g'].includes(effectiveType)) {
    return {
      description: 'Połączenie internetowe',
      id: 'network',
      message: `Wolne połączenie (${effectiveType})`,
      name: 'Sieć',
      status: 'degraded'
    };
  }

  return {
    description: 'Połączenie internetowe',
    id: 'network',
    message: effectiveType ? `Online (${effectiveType})` : 'Online',
    name: 'Sieć',
    status: 'ok'
  };
}

async function checkOcrModels(): Promise<HealthCheckItem> {
  const flags = getFeatureFlags();
  if (!flags.isEnabled('ocr')) {
    return {
      description: 'Rozpoznawanie tekstu z obrazów',
      id: 'ocr',
      message: 'OCR wyłączone (brak COOP/COEP lub kill-switch)',
      name: 'OCR (Tesseract)',
      status: 'unavailable'
    };
  }

  try {
    const response = await fetch('/vendor/tesseract/tesseract-core.wasm', { method: 'HEAD' });
    if (response.ok) {
      return {
        description: 'Rozpoznawanie tekstu z obrazów',
        id: 'ocr',
        message: 'Modele Tesseract dostępne',
        name: 'OCR (Tesseract)',
        status: 'ok'
      };
    }
    return {
      description: 'Rozpoznawanie tekstu z obrazów',
      id: 'ocr',
      message: 'Brak pliku WASM – OCR może nie działać',
      name: 'OCR (Tesseract)',
      status: 'degraded'
    };
  } catch {
    return {
      description: 'Rozpoznawanie tekstu z obrazów',
      id: 'ocr',
      message: 'Nie udało się sprawdzić modeli OCR',
      name: 'OCR (Tesseract)',
      status: 'degraded'
    };
  }
}

async function checkServiceWorker(): Promise<HealthCheckItem> {
  if (!('serviceWorker' in navigator)) {
    return {
      description: 'Cache offline i PWA',
      id: 'service-worker',
      message: 'Service Worker niedostępny',
      name: 'Service Worker',
      status: 'unavailable'
    };
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg?.active) {
      return {
        description: 'Cache offline i PWA',
        id: 'service-worker',
        message: 'SW aktywny, cache dostępny',
        name: 'Service Worker',
        status: 'ok'
      };
    }
    return {
      description: 'Cache offline i PWA',
      id: 'service-worker',
      message: 'SW zarejestrowany, ale nieaktywny',
      name: 'Service Worker',
      status: 'degraded'
    };
  } catch {
    return {
      description: 'Cache offline i PWA',
      id: 'service-worker',
      message: 'Nie udało się sprawdzić SW',
      name: 'Service Worker',
      status: 'degraded'
    };
  }
}

async function checkStorage(): Promise<HealthCheckItem> {
  if (!navigator.storage?.estimate) {
    return {
      description: 'Dostępna przestrzeń dyskowa',
      id: 'storage',
      message: 'Nie można sprawdzić limitu storage',
      name: 'Storage',
      status: 'degraded'
    };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usedMB = Math.round((estimate.usage || 0) / 1024 / 1024);
    const quotaMB = Math.round((estimate.quota || 0) / 1024 / 1024);
    const percentUsed = quotaMB > 0 ? Math.round((usedMB / quotaMB) * 100) : 0;

    if (percentUsed > 90) {
      return {
        critical: true,
        description: 'Dostępna przestrzeń dyskowa',
        id: 'storage',
        message: `Mało miejsca: ${usedMB}MB / ${quotaMB}MB (${percentUsed}%)`,
        name: 'Storage',
        status: 'degraded'
      };
    }

    return {
      description: 'Dostępna przestrzeń dyskowa',
      id: 'storage',
      message: `${usedMB}MB / ${quotaMB}MB (${percentUsed}%)`,
      name: 'Storage',
      status: 'ok'
    };
  } catch {
    return {
      description: 'Dostępna przestrzeń dyskowa',
      id: 'storage',
      message: 'Błąd sprawdzania storage',
      name: 'Storage',
      status: 'degraded'
    };
  }
}

async function checkWebWorkers(): Promise<HealthCheckItem> {
  if (typeof Worker === 'undefined') {
    return {
      description: 'Przetwarzanie w tle',
      id: 'workers',
      message: 'Web Workers niedostępne',
      name: 'Web Workers',
      status: 'unavailable'
    };
  }

  const flags = getFeatureFlags();
  if (!flags.isEnabled('workerParser')) {
    return {
      description: 'Przetwarzanie w tle',
      id: 'workers',
      message: 'Parser działa w głównym wątku (brak COOP/COEP)',
      name: 'Web Workers',
      status: 'degraded'
    };
  }

  return {
    description: 'Przetwarzanie w tle',
    id: 'workers',
    message: 'Parser Worker aktywny',
    name: 'Web Workers',
    status: 'ok'
  };
}

// Auto-run health check on startup and show if degraded
let startupReport: HealthCheckReport | null = null;

export function getStartupReport(): HealthCheckReport | null {
  return startupReport;
}

export async function initHealthCheck(config: HealthCheckConfig = {}): Promise<HealthCheckReport> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const report = await runHealthCheck();
  startupReport = report;

  const shouldShow =
    (cfg.showOnUnavailable && report.overall === 'unavailable') ||
    (cfg.showOnDegraded && report.overall === 'degraded');

  if (shouldShow) {
    showHealthCheckModal(report, cfg);
  } else if (cfg.autoDismissOk && report.overall === 'ok') {
    console.log('[HealthCheck] All systems OK', report);
  }

  cfg.onComplete?.(report);
  return report;
}

export function showHealthCheckModal(
  report: HealthCheckReport,
  config: HealthCheckConfig = {}
): void {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.id = 'health-check-modal';
  overlay.className = 'health-check-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'health-check-title');

  const modal = document.createElement('div');
  modal.className = 'health-check-modal';

  renderHealthCheckReport(report, modal);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'health-check-close btn-paper';
  closeBtn.textContent = 'Kontynuuj';
  closeBtn.addEventListener('click', () => {
    overlay.remove();
  });

  modal.append(closeBtn);
  overlay.append(modal);
  document.body.append(overlay);

  // Focus close button
  closeBtn.focus();
}

// Export to window
if (typeof window !== 'undefined') {
  (window as any).healthCheck = {
    getStartupReport,
    init: initHealthCheck,
    render: renderHealthCheckReport,
    run: runHealthCheck
  };
}
