import { beforeEach, describe, expect, it, vi } from 'vitest';

const bootstrapSideEffects = [
  '../config/languageConfigLoader.js',
  '../schema/schemaRegistry.js',
  '../mapping/contextResolver.js',
  '../mapping/smartHeaderMapper.js',
  '../parsing/formatInspector.js',
  '../parsing/workerParser',
  '../storage/db',
  '../storage/state'
] as const;

function mockBootstrapSideEffects() {
  for (const modulePath of bootstrapSideEffects) {
    vi.doMock(modulePath, () => ({}));
  }
}

describe('legacyBootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockBootstrapSideEffects();
  });

  it('initializes the legacy runtime bridge only once', async () => {
    const initNewSystem = vi.fn();
    const initializeLegacyRuntimeBridge = vi.fn(async () => {});

    vi.doMock('../data/dataProcessor', () => ({
      processor: {
        _initNewSystem: initNewSystem
      }
    }));
    vi.doMock('./legacyRuntimeBridge', () => ({
      initializeLegacyRuntimeBridge
    }));

    const { initializeLegacyBootstrap } = await import('./legacyBootstrap');

    const firstCall = initializeLegacyBootstrap();
    const secondCall = initializeLegacyBootstrap();

    await expect(firstCall).resolves.toBeUndefined();
    await expect(secondCall).resolves.toBeUndefined();
    expect(initializeLegacyRuntimeBridge).toHaveBeenCalledTimes(1);
    expect(initNewSystem).toHaveBeenCalledTimes(1);
  });

  it('propagates bootstrap failures', async () => {
    const initializeLegacyRuntimeBridge = vi.fn().mockRejectedValue(new Error('bridge failed'));

    vi.doMock('../data/dataProcessor', () => ({
      processor: {
        _initNewSystem: vi.fn()
      }
    }));
    vi.doMock('./legacyRuntimeBridge', () => ({
      initializeLegacyRuntimeBridge
    }));

    const { initializeLegacyBootstrap } = await import('./legacyBootstrap');

    await expect(initializeLegacyBootstrap()).rejects.toThrow('bridge failed');
  });
});
