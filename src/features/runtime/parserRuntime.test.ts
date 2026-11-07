// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const appendDiagnosticsLog = vi.fn();
const getCurrentProfileReport = vi.fn();
const isFeatureEnabled = vi.fn();
const getParserBridge = vi.fn();

const circuitBreakerInstances: MockCircuitBreaker[] = [];
const watchdogInstances: MockWatchdog[] = [];

class MockCircuitBreaker {
  recordFailure = vi.fn();
  recordSuccess = vi.fn();

  constructor(public readonly config: Record<string, unknown>) {
    circuitBreakerInstances.push(this);
  }
}

class MockWatchdog {
  start = vi.fn();
  stop = vi.fn();

  constructor(public readonly config: Record<string, unknown>) {
    watchdogInstances.push(this);
  }
}

vi.mock('@/features/diagnostics/runtimeDiagnostics', () => ({
  appendDiagnosticsLog,
  getCurrentProfileReport
}));

vi.mock('@/config/featureFlags', () => ({
  isFeatureEnabled
}));

vi.mock('@/workerBridge', () => ({
  CircuitBreaker: MockCircuitBreaker,
  getParserBridge,
  Watchdog: MockWatchdog
}));

describe('parserRuntime', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    circuitBreakerInstances.length = 0;
    watchdogInstances.length = 0;
    (window as any).parserBridge = undefined;
    getCurrentProfileReport.mockReturnValue({ profile: 'full' });
    isFeatureEnabled.mockReturnValue(true);
  });

  it('skips init when worker parser feature is disabled', async () => {
    isFeatureEnabled.mockReturnValue(false);

    const { initParserWorker } = await import('./parserRuntime');

    await initParserWorker();

    expect(getParserBridge).not.toHaveBeenCalled();
    expect(circuitBreakerInstances).toHaveLength(0);
  });

  it('skips init in ts-only profile', async () => {
    getCurrentProfileReport.mockReturnValue({ profile: 'ts-only' });

    const { initParserWorker } = await import('./parserRuntime');

    await initParserWorker();

    expect(getParserBridge).not.toHaveBeenCalled();
    expect(circuitBreakerInstances).toHaveLength(0);
  });

  it('initializes parser bridge, watchdog and window binding', async () => {
    const bridge = {
      getState: vi.fn(() => 'idle'),
      init: vi.fn<() => Promise<void>>().mockResolvedValue(),
      terminate: vi.fn()
    };
    getParserBridge.mockReturnValue(bridge);

    const { initParserWorker, teardownParserWorker } = await import('./parserRuntime');

    await initParserWorker();

    expect(getParserBridge).toHaveBeenCalledOnce();
    expect(bridge.init).toHaveBeenCalledOnce();
    expect(circuitBreakerInstances).toHaveLength(1);
    expect(watchdogInstances).toHaveLength(1);
    expect(watchdogInstances[0].start).toHaveBeenCalledOnce();
    expect((window as any).parserBridge).toBe(bridge);

    teardownParserWorker();
    expect(watchdogInstances[0].stop).toHaveBeenCalledOnce();
    expect(bridge.terminate).toHaveBeenCalledOnce();
    expect((window as any).parserBridge).toBeUndefined();
  });
});
