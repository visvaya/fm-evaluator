import { getStructureHashCache, startAutoPrune } from './cache/structureHashCache';
import { COUNTRY_CODE_MAP, FEET_MAPPING, mapCountryCode } from './config/constants';
import { getFeatureFlags } from './config/featureFlags';
import { ldcCache, ldcSettings } from './config/ldcConfig';
import { computeStructureHash } from './data/computeStructureHash';
import {
  buildDiagnosticsSnapshot,
  copyDiagnosticsSnapshot,
  exportDiagnosticsSnapshot,
  initializeDiagnosticsRuntime,
  type ProfileReport
} from './features/diagnostics/runtimeDiagnostics';
import { installLegacyInteractions } from './features/legacyRuntime/legacyInteractions';
import { initParserWorker } from './features/runtime/parserRuntime';
import { patchDomParserForCsp, patchTesseractSelfHosted } from './features/runtime/runtimePatches';
import {
  getActiveModalTrap,
  installLanguageBindings,
  setupPossessionModalFocusTrap,
  setupSettingsModalFocusTrap
} from './features/runtime/runtimeUiBindings';
import i18n from './i18n';
import { useSettingsStore } from './store/useSettingsStore';
import { createFocusTrap } from './ui/focusTrap';
import { getStartupReport, initHealthCheck } from './ui/healthCheck';
import { getOfflineIndicator, initOfflineIndicator } from './ui/offlineIndicator';

// Bridge legacy globals – getter ensures always-current store state
Object.defineProperty(window, 'APP_SETTINGS', {
  configurable: true,
  get: () => useSettingsStore.getState().settings
});
(window as any).LDC_SETTINGS = ldcSettings;
(window as any).LDC_CACHE = ldcCache;
(window as any).FEET_MAPPING = FEET_MAPPING;
(window as any).COUNTRY_CODE_MAP = COUNTRY_CODE_MAP;
(window as any).mapCountryCode = mapCountryCode;

function applyProfileDataset(report: ProfileReport) {
  document.documentElement.dataset.runtimeProfile = report.profile;
  if (document.body) {
    document.body.dataset.runtimeProfile = report.profile;
  }
}

async function bootRuntime() {
  ensureComputeStructureHash();
  patchDomParserForCsp();
  patchTesseractSelfHosted();

  // Initialize feature flags early
  const flags = getFeatureFlags();
  console.log('[Runtime] Feature flags initialized:', flags.getProfile());

  // Initialize structure hash cache with auto-prune
  getStructureHashCache();
  startAutoPrune();
  console.log('[Runtime] Structure hash cache initialized');

  // Initialize i18n before language bindings
  await i18n.init();
  i18n.applyToDom();

  installLanguageBindings();
  installLegacyInteractions({ copyTextToClipboard });

  // Use new offline indicator instead of simple banner
  initOfflineIndicator({
    onStateChange: (online) => {
      console.log(`[Runtime] Network state: ${online ? 'online' : 'offline'}`);
    }
  });

  initializeDiagnosticsRuntime({
    onProfileChange: (report) => {
      applyProfileDataset(report);
      maybePrefetchVendors(report);
    }
  });
  requestPersistentStorage();
  exposeDiagnosticsApi();
  exposeIntegrationApis();
  setupSettingsModalFocusTrap();
  setupPossessionModalFocusTrap();
  await initParserWorker();

  // Run health check after everything is initialized
  const healthReport = await initHealthCheck({
    autoDismissOk: true,
    onComplete: (report) => {
      console.log('[Runtime] Health check complete:', report.overall, report.profile);
    },
    showOnDegraded: false,
    showOnUnavailable: false
  });

  // Log startup summary
  console.log(
    `[Runtime] Boot complete. Profile: ${flags.getProfile()}, Health: ${healthReport.overall}`
  );
}

async function copyTextToClipboard(text: string) {
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
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

// Compatibility bridge only: src/data/parseHTMLWithNewSystem.ts imports
// computeStructureHash directly and no longer depends on this global (that
// dependency used to race the async runtime bootstrap on fast uploads). Kept
// here in case external tooling/diagnostics still reach for window.*.
function ensureComputeStructureHash() {
  if (typeof (window as any).computeStructureHash === 'function') return;
  (window as any).computeStructureHash = computeStructureHash;
}

function exposeDiagnosticsApi() {
  const api = {
    copy: () => copyDiagnosticsSnapshot(buildDiagnosticsSnapshot()),
    export: () => exportDiagnosticsSnapshot(buildDiagnosticsSnapshot()),
    snapshot: () => buildDiagnosticsSnapshot()
  };
  (window as any).fmDiagnostics = api;
}

function exposeIntegrationApis() {
  // Expose feature flags to window
  (window as any).fmFeatureFlags = getFeatureFlags();

  // Expose structure hash cache
  (window as any).fmStructureHashCache = getStructureHashCache();

  // Expose offline indicator
  (window as any).fmOfflineIndicator = getOfflineIndicator();

  // Expose health check
  (window as any).fmHealthCheck = {
    getStartupReport,
    rerun: () => initHealthCheck()
  };

  // Expose focus trap for modals
  (window as any).fmFocusTrap = {
    create: createFocusTrap,
    getActive: () => getActiveModalTrap()
  };
}

function maybePrefetchVendors(report: ProfileReport) {
  const slowConnection = report.effectiveType
    ? ['2g', '3g', 'slow-2g'].includes(report.effectiveType)
    : false;
  if (report.profile !== 'full') return;
  if (report.saveData || slowConnection) return;
  postToServiceWorker({ type: 'PREFETCH_VENDOR' });
}

function postToServiceWorker(message: any) {
  if (!navigator.serviceWorker) return;
  const send = (worker: null | ServiceWorker | undefined) => {
    try {
      worker?.postMessage(message);
    } catch (error) {
      console.warn('[ServiceWorker] postMessage failed', error);
    }
  };
  if (navigator.serviceWorker.controller) {
    send(navigator.serviceWorker.controller);
    return;
  }
  navigator.serviceWorker.ready.then((reg) => {
    send(reg.active);
  });
}

function requestPersistentStorage() {
  if (!navigator.storage?.persist) return;
  navigator.storage.persist().catch((error) => {
    console.warn('[Storage] Persist request failed', error);
  });
}

bootRuntime().catch((error) => {
  console.error('[Runtime] boot failed', error);
});
