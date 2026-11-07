import { isFeatureEnabled } from '@/config/featureFlags';
import {
  appendDiagnosticsLog,
  getCurrentProfileReport
} from '@/features/diagnostics/runtimeDiagnostics';
import { CircuitBreaker, getParserBridge, type ParserBridge, Watchdog } from '@/workerBridge';

let parserBridge: null | ParserBridge = null;
let parserCircuitBreaker: CircuitBreaker | null = null;
let parserWatchdog: null | Watchdog = null;
let parserTeardownBound = false;

async function restartParserWorker(): Promise<void> {
  teardownParserWorker();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await initParserWorker();
}

function bindParserWorkerTeardown() {
  if (parserTeardownBound) return;

  const cleanup = () => {
    teardownParserWorker();
  };

  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('pagehide', cleanup);
  parserTeardownBound = true;
}

export async function initParserWorker(): Promise<void> {
  if (parserBridge) return;

  if (!isFeatureEnabled('workerParser')) {
    console.log('[ParserWorker] Worker parser disabled by feature flag');
    return;
  }

  const profile = getCurrentProfileReport();
  if (profile?.profile === 'ts-only') {
    console.log('[ParserWorker] Skipping worker init in ts-only mode');
    return;
  }

  parserCircuitBreaker = new CircuitBreaker({
    failureThreshold: 3,
    onFallback: () => {
      console.warn('[ParserWorker] Circuit open, using main thread fallback');
    },
    onStateChange: (state, reason) => {
      console.log(`[ParserWorker] Circuit breaker: ${state} (${reason})`);
      if (state === 'open') {
        appendDiagnosticsLog(`Parser worker circuit open: ${reason}`);
      }
    },
    resetTimeout: 30000,
    successThreshold: 2
  });

  try {
    parserBridge = getParserBridge({
      onError: (error) => {
        console.error('[ParserWorker] Error:', error);
        parserCircuitBreaker?.recordFailure(
          error instanceof Error ? error : new Error(String(error))
        );
      },
      onStateChange: (state) => {
        console.log('[ParserWorker] State:', state);
        if (state === 'idle') {
          parserCircuitBreaker?.recordSuccess();
        }
      },
      timeout: 30000
    });
    await parserBridge.init();

    parserWatchdog = new Watchdog({
      heartbeatInterval: 10000,
      heartbeatTimeout: 5000,
      maxMissedHeartbeats: 3,
      onRecovered: () => {
        console.log('[ParserWorker] Watchdog: worker recovered');
      },
      onUnresponsive: () => {
        console.error('[ParserWorker] Watchdog: worker unresponsive, restarting...');
        appendDiagnosticsLog('Parser worker unresponsive - restarting');
        void restartParserWorker();
      }
    });

    parserWatchdog.start(async () => {
      if (!parserBridge) return false;
      try {
        return parserBridge.getState() !== 'error';
      } catch {
        return false;
      }
    });

    (window as any).parserBridge = parserBridge;
    bindParserWorkerTeardown();
    console.log('[ParserWorker] Initialized with circuit breaker and watchdog');
  } catch (error) {
    console.warn('[ParserWorker] Failed to init, falling back to main thread:', error);
    parserCircuitBreaker?.recordFailure(error instanceof Error ? error : new Error(String(error)));
    parserBridge = null;
  }
}

export function teardownParserWorker(): void {
  if (parserWatchdog) {
    parserWatchdog.stop();
    parserWatchdog = null;
  }
  if (parserBridge) {
    parserBridge.terminate();
    parserBridge = null;
  }
  parserCircuitBreaker = null;
  (window as any).parserBridge = undefined;
}
