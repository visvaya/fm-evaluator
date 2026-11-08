// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Header from '@/components/Header';
import {
  resetDiagnosticsStore,
  useDiagnosticsStore
} from '@/features/diagnostics/runtimeDiagnostics';
import { useTableStore } from '@/store/useTableStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';

import { DiagnosticsShell } from './DiagnosticsShell';

const translateKey = (key: string) => key;

vi.mock('@/hooks/useUiText', () => ({
  useUiText: () => translateKey
}));

describe('DiagnosticsShell', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    useTableStore.setState({
      bootstrap: { error: null, ready: true },
      currentEngine: 'Default',
      currentPosition: '',
      mergeMode: 'merge'
    });
    useWorkspaceStore.setState({
      activeRailSection: 'none',
      graphicsEnabled: true,
      isDiagnosticsOpen: false,
      isFileManagerOpen: false,
      isLdcOpen: false,
      isSettingsOpen: false,
      lastFocusedElement: null
    } as any);
    resetDiagnosticsStore();
    useDiagnosticsStore.setState({
      dbHealth: {
        backups: 1,
        lastAudit: Date.now(),
        tables: {
          audit: 1,
          files: 2,
          ldcMappings: 3,
          ldcSettings: 4,
          settings: 5,
          uiState: 6
        },
        version: 5
      },
      profileReport: {
        crossOriginIsolated: true,
        effectiveType: '4g',
        hasIndexedDb: true,
        lowHardware: false,
        profile: 'full',
        reasons: [],
        saveData: false
      },
      serviceWorkerHealth: {
        backupAvailable: true,
        cachedEntries: 4,
        cacheName: 'fm-cache',
        profile: null,
        swVersion: '1.0.0'
      }
    });
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

  it('opens and closes from the header diagnostics button', () => {
    act(() => {
      root.render(
        createElement('div', null, createElement(Header), createElement(DiagnosticsShell))
      );
    });

    const trigger = container.querySelector<HTMLButtonElement>('#toggle-diagnostics-panel');
    const panel = () => container.querySelector<HTMLElement>('#diagnostics-panel');

    expect(panel()?.className).toContain('hidden');

    act(() => {
      trigger?.click();
    });
    expect(panel()?.className).toContain('absolute');
    expect(container.textContent).toContain('Profil FULL');

    act(() => {
      trigger?.click();
    });
    expect(panel()?.className).toContain('hidden');
  });
});
