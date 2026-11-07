// @vitest-environment jsdom
import { act, createElement, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface MockStoreState {
  bootstrap: {
    error: null | string;
    ready: boolean;
  };
  data: unknown[];
  filteredData: unknown[];
  importStatus: {
    kind: string;
    message: string;
  };
  setBootstrapState: (bootstrap: Partial<MockStoreState['bootstrap']>) => void;
}

function uninitializedSetBootstrapState(): never {
  throw new Error('setBootstrapState mock not initialized');
}

function createStoreState(): MockStoreState {
  return {
    bootstrap: {
      error: null,
      ready: false
    },
    data: [],
    filteredData: [],
    importStatus: {
      kind: 'idle',
      message: ''
    },
    setBootstrapState: uninitializedSetBootstrapState
  };
}

let storeState = createStoreState();
const listeners = new Set<() => void>();
const HeaderStub = () => createElement('div', null, 'header');
const CompatibilityHostStub = () => createElement('div', null, 'compat-host');
const FileManagerModalStub = () => createElement('div', null, 'file-manager-modal');
const ImportStatusBannerStub = () => createElement('div', null, 'import-banner');
const LeftRailStub = () => createElement('div', null, 'left-rail');
const PlayerDetailsStub = () => createElement('div', null, 'player-details');
const PlayerTableStub = () => createElement('div', null, 'player-table');
const translateKey = (key: string) => key;
const processFilesMock = vi.fn();
const runAnalysisMock = vi.fn();

function emitStoreChange() {
  for (const listener of listeners) {
    listener();
  }
}

function resetStoreState() {
  storeState = createStoreState();
  storeState.setBootstrapState = (bootstrap) => {
    storeState = {
      ...storeState,
      bootstrap: {
        ...storeState.bootstrap,
        ...bootstrap
      }
    };
    emitStoreChange();
  };
  emitStoreChange();
}

const initializeLegacyBootstrap = vi.fn<() => Promise<void>>();

vi.mock('./components/Header', () => ({
  default: HeaderStub
}));

vi.mock('./components/CompatibilityHost', () => ({
  CompatibilityHost: CompatibilityHostStub
}));

vi.mock('./components/FileManagerModal', () => ({
  FileManagerModal: FileManagerModalStub
}));

vi.mock('./components/ImportStatusBanner', () => ({
  ImportStatusBanner: ImportStatusBannerStub
}));

vi.mock('./components/LeftRail', () => ({
  LeftRail: LeftRailStub
}));

vi.mock('./features/playerDetails/PlayerDetails', () => ({
  PlayerDetails: PlayerDetailsStub
}));

vi.mock('./components/PlayerTable', () => ({
  default: PlayerTableStub
}));

vi.mock('./hooks/useUiText', () => ({
  useUiText: () => translateKey
}));

vi.mock('./hooks/useDataBoundary', () => ({
  useDataBoundary: () => ({
    isProcessing: false,
    processFiles: processFilesMock,
    runAnalysis: runAnalysisMock
  })
}));

vi.mock('./lib/legacyBootstrap', () => ({
  initializeLegacyBootstrap
}));

vi.mock('./features/workspace/useWorkspaceSurfaceSync', () => ({
  useWorkspaceSurfaceSync: vi.fn()
}));

vi.mock('./features/workspace/shortcuts', () => ({
  useAppShortcuts: vi.fn()
}));

vi.mock('./store/useTableStore', () => ({
  useTableStore: () =>
    useSyncExternalStore(
      (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      () => storeState
    )
}));

describe('App', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    resetStoreState();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows runtime ready after successful bootstrap', async () => {
    initializeLegacyBootstrap.mockImplementation(() => Promise.resolve());
    const { default: App } = await import('./App');

    act(() => {
      root.render(createElement(App));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('runtime_ready');
    expect(container.textContent).not.toContain('bootstrap_failed');
  });

  it('shows bootstrap error state when bootstrap fails', async () => {
    initializeLegacyBootstrap.mockRejectedValue(new Error('bridge failed'));
    const { default: App } = await import('./App');

    act(() => {
      root.render(createElement(App));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('bootstrap_failed');
    expect(container.textContent).toContain('bridge failed');
  });
});
