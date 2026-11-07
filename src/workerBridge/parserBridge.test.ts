import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface MockParserApi {
  parse: ReturnType<typeof vi.fn>;
  parseBatch: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
}

const wrapMock = vi.fn();
const exposeMock = vi.fn();
const transferMock = vi.fn((value) => value);

let mockApi: MockParserApi;
let workerInstances: FakeWorker[] = [];

vi.mock('comlink', () => ({
  expose: exposeMock,
  transfer: transferMock,
  wrap: wrapMock
}));

class FakeWorker {
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  terminate = vi.fn();
  private readonly listeners = new Map<string, Set<(event: Event) => void>>();

  constructor(_url: URL, _options?: WorkerOptions) {
    workerInstances.push(this);
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type: 'error', event: ErrorEvent): void;
  dispatch(type: 'messageerror', event: MessageEvent): void;
  dispatch(type: 'error' | 'messageerror', event: ErrorEvent | MessageEvent): void {
    if (type === 'error') {
      this.onerror?.(event as ErrorEvent);
    } else {
      this.onmessageerror?.(event as MessageEvent);
    }

    const listeners = this.listeners.get(type);
    listeners?.forEach((listener) => listener(event));
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    const listeners = this.listeners.get(type);
    listeners?.delete(listener);
  }
}

function createMockApi(): MockParserApi {
  return {
    parse: vi.fn(),
    parseBatch: vi.fn(),
    ping: vi.fn()
  };
}

function createPendingPromise<T>(): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(resolve, 60000);
  });
}

async function captureRejection<T>(promise: Promise<T>) {
  try {
    return { error: null, value: await promise };
  } catch (error) {
    return { error, value: null };
  }
}

async function loadParserBridgeModule() {
  return import('./parserBridge');
}

describe('workerBridge/parserBridge', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    vi.restoreAllMocks();

    workerInstances = [];
    mockApi = createMockApi();
    wrapMock.mockImplementation(() => mockApi);

    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('crossOriginIsolated', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('initializes worker bridge and pings the worker API', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(vi.fn());
    mockApi.ping.mockResolvedValue('pong');

    const { createParserBridge } = await loadParserBridgeModule();
    const onStateChange = vi.fn();
    const bridge = createParserBridge({ onStateChange });

    await bridge.init();

    expect(workerInstances).toHaveLength(1);
    expect(wrapMock).toHaveBeenCalledWith(workerInstances[0]);
    expect(mockApi.ping).toHaveBeenCalledOnce();
    expect(bridge.getState()).toBe('idle');
    expect(onStateChange).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('[ParserBridge] Worker initialized successfully');
  });

  it('reuses the same init promise for concurrent initialization', async () => {
    mockApi.ping.mockResolvedValue('pong');

    const { createParserBridge } = await loadParserBridgeModule();
    const bridge = createParserBridge();

    await Promise.all([bridge.init(), bridge.init()]);

    expect(workerInstances).toHaveLength(1);
    expect(mockApi.ping).toHaveBeenCalledOnce();
  });

  it('delegates parse calls to the worker API and returns the result', async () => {
    mockApi.ping.mockResolvedValue('pong');
    mockApi.parse.mockResolvedValue({ value: 42 });

    const { createParserBridge } = await loadParserBridgeModule();
    const onStateChange = vi.fn();
    const bridge = createParserBridge({ onStateChange });

    const schemaInfo = { id: 'goals', type: 'integer' as const };
    const formatContext = { decimalSeparator: ',' };
    const normalizationConfig = { targetWageFrequency: 'weekly' as const };
    const languageConfig = { multipliers: { K: 1000 } };

    const result = await bridge.parse(
      '42',
      schemaInfo,
      formatContext,
      normalizationConfig,
      languageConfig
    );

    expect(result).toEqual({ value: 42 });
    expect(mockApi.parse).toHaveBeenCalledWith(
      '42',
      schemaInfo,
      formatContext,
      normalizationConfig,
      languageConfig
    );
    expect(onStateChange).toHaveBeenNthCalledWith(1, 'busy');
    expect(onStateChange).toHaveBeenNthCalledWith(2, 'idle');
  });

  it('delegates parseBatch requests to the worker API', async () => {
    mockApi.ping.mockResolvedValue('pong');
    mockApi.parseBatch.mockResolvedValue({
      duration: 12,
      results: [{ value: 1 }, { value: 2 }]
    });

    const { createParserBridge } = await loadParserBridgeModule();
    const bridge = createParserBridge();
    const request = {
      formatContext: {},
      schemaInfo: { id: 'age', type: 'integer' as const },
      values: ['1', '2']
    };

    const result = await bridge.parseBatch(request);

    expect(result).toEqual({
      duration: 12,
      results: [{ value: 1 }, { value: 2 }]
    });
    expect(mockApi.parseBatch).toHaveBeenCalledWith(request);
    expect(bridge.getState()).toBe('idle');
  });

  it('marks the bridge as error when parse rejects', async () => {
    mockApi.ping.mockResolvedValue('pong');
    mockApi.parse.mockRejectedValue(new Error('worker crashed'));

    const { createParserBridge } = await loadParserBridgeModule();
    const onStateChange = vi.fn();
    const bridge = createParserBridge({ onStateChange });

    await expect(bridge.parse('x', { id: 'name', type: 'string' })).rejects.toThrow(
      'worker crashed'
    );

    expect(bridge.getState()).toBe('error');
    expect(onStateChange).toHaveBeenLastCalledWith('error');
  });

  it('times out parse calls and switches state to error', async () => {
    vi.useFakeTimers();
    mockApi.ping.mockResolvedValue('pong');
    mockApi.parse.mockReturnValue(createPendingPromise());

    const { createParserBridge } = await loadParserBridgeModule();
    const bridge = createParserBridge({ timeout: 25 });

    const parseResult = captureRejection(bridge.parse('x', { id: 'name', type: 'string' }));
    await vi.advanceTimersByTimeAsync(25);
    const { error } = await parseResult;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Operation timed out');
    expect(bridge.getState()).toBe('error');
  });

  it('reports init timeout through onError and error state', async () => {
    vi.useFakeTimers();
    mockApi.ping.mockReturnValue(createPendingPromise());

    const { createParserBridge } = await loadParserBridgeModule();
    const onError = vi.fn();
    const bridge = createParserBridge({ onError });

    const initResult = captureRejection(bridge.init());
    await vi.advanceTimersByTimeAsync(5000);
    const { error } = await initResult;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Operation timed out');
    expect(bridge.getState()).toBe('error');
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Operation timed out' })
    );
  });

  it('handles worker crash events through the registered onerror callback', async () => {
    mockApi.ping.mockResolvedValue('pong');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());
    const { createParserBridge } = await loadParserBridgeModule();
    const onError = vi.fn();
    const onStateChange = vi.fn();
    const bridge = createParserBridge({ onError, onStateChange });

    await bridge.init();
    workerInstances[0].dispatch('error', {
      colno: 7,
      filename: 'http://localhost/parser.worker.js',
      isTrusted: true,
      lineno: 12,
      message: 'crash'
    } as ErrorEvent);

    expect(bridge.getState()).toBe('error');
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'crash (http://localhost/parser.worker.js:12:7)' })
    );
    expect(onStateChange).toHaveBeenLastCalledWith('error');
    expect(errorSpy).toHaveBeenCalledWith(
      '[ParserBridge] Worker error:',
      '{"colno":7,"filename":"http://localhost/parser.worker.js","isTrusted":true,"kind":"error","lineno":12,"message":"crash"}'
    );
  });

  it('reports messageerror events with dedicated diagnostics', async () => {
    mockApi.ping.mockResolvedValue('pong');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());
    const { createParserBridge } = await loadParserBridgeModule();
    const onError = vi.fn();
    const bridge = createParserBridge({ onError });

    await bridge.init();
    workerInstances[0].dispatch('messageerror', { isTrusted: true } as MessageEvent);

    expect(bridge.getState()).toBe('error');
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Parser worker messageerror' })
    );
    expect(errorSpy).toHaveBeenCalledWith(
      '[ParserBridge] Worker messageerror:',
      '{"colno":null,"filename":null,"isTrusted":true,"kind":"messageerror","lineno":null,"message":null}'
    );
  });

  it('ignores worker error events after terminate', async () => {
    mockApi.ping.mockResolvedValue('pong');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());
    const { createParserBridge } = await loadParserBridgeModule();
    const onError = vi.fn();
    const bridge = createParserBridge({ onError });

    await bridge.init();
    bridge.terminate();
    workerInstances[0].dispatch('error', { isTrusted: true, message: 'late crash' } as ErrorEvent);

    expect(bridge.getState()).toBe('terminated');
    expect(onError).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('restart terminates the current worker and creates a fresh one', async () => {
    mockApi.ping.mockResolvedValue('pong');

    const { createParserBridge } = await loadParserBridgeModule();
    const bridge = createParserBridge();

    await bridge.init();
    const firstWorker = workerInstances[0];

    await bridge.restart();

    expect(firstWorker.terminate).toHaveBeenCalledOnce();
    expect(workerInstances).toHaveLength(2);
    expect(mockApi.ping).toHaveBeenCalledTimes(2);
    expect(bridge.getState()).toBe('idle');
  });

  it('terminate shuts down the worker and marks the bridge as terminated', async () => {
    mockApi.ping.mockResolvedValue('pong');

    const { createParserBridge } = await loadParserBridgeModule();
    const bridge = createParserBridge();

    await bridge.init();
    const firstWorker = workerInstances[0];

    bridge.terminate();

    expect(firstWorker.terminate).toHaveBeenCalledOnce();
    expect(bridge.getState()).toBe('terminated');
  });

  it('getParserBridge returns the same singleton instance', async () => {
    mockApi.ping.mockResolvedValue('pong');

    const { getParserBridge } = await loadParserBridgeModule();

    const first = getParserBridge({ timeout: 10 });
    const second = getParserBridge({ timeout: 50 });

    expect(first).toBe(second);
  });
});
