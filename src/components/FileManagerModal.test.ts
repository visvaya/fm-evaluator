// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Header from '@/components/Header';
import { useTableStore } from '@/store/useTableStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { fileStack } from '@/ui/fileStack';

import { FileManagerModal } from './FileManagerModal';

const processFilesMock = vi.fn();
const translateKey = (key: string) => key;

vi.mock('@/hooks/useDataBoundary', () => ({
  useDataBoundary: () => ({
    isProcessing: false,
    processFiles: processFilesMock
  })
}));

vi.mock('@/hooks/useUiText', () => ({
  useUiText: () => translateKey
}));

function setDefaultStores() {
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
}

function setProcessorStack(fileStackItems: Record<string, unknown>[]) {
  vi.stubGlobal('processor', {
    fileStack: fileStackItems
  });
}

describe('FileManagerModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    setDefaultStores();
    setProcessorStack([]);
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('opens from Header button and closes on Escape', () => {
    act(() => {
      root.render(
        createElement('div', null, createElement(Header), createElement(FileManagerModal))
      );
    });

    const trigger = container.querySelector<HTMLButtonElement>('#manage-files-btn');
    expect(trigger).not.toBeNull();

    act(() => {
      trigger?.click();
    });
    expect(container.textContent).toContain('manage_files');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(container.textContent).not.toContain('drop_files_here');
  });

  it('closes when backdrop is clicked', () => {
    useWorkspaceStore.getState().openFileManager();
    act(() => {
      root.render(createElement(FileManagerModal));
    });

    const backdrop = container.querySelector<HTMLElement>(
      '[data-testid="file-manager-modal-backdrop"]'
    );
    expect(backdrop).not.toBeNull();
    act(() => {
      backdrop?.click();
    });

    expect(container.textContent).not.toContain('drop_files_here');
  });

  it('renders empty stack state', () => {
    useWorkspaceStore.getState().openFileManager();
    act(() => {
      root.render(createElement(FileManagerModal));
    });
    expect(container.textContent).toContain('no_data_loaded');
  });

  it('renders non-empty stack state', () => {
    setProcessorStack([
      {
        detectedLanguage: 'en',
        name: 'players.html',
        rowCount: 5,
        type: 'complete'
      }
    ]);
    useWorkspaceStore.getState().openFileManager();

    act(() => {
      root.render(createElement(FileManagerModal));
    });

    expect(container.textContent).toContain('players.html');
  });

  it('updates merge mode in store', () => {
    useWorkspaceStore.getState().openFileManager();
    act(() => {
      root.render(createElement(FileManagerModal));
    });

    const inputs = container.querySelectorAll<HTMLInputElement>('input[name="react-merge-mode"]');
    act(() => {
      inputs[1]?.click();
    });

    expect(useTableStore.getState().mergeMode).toBe('replace');
  });

  it('delegates remove/remap/reorder actions to legacy file stack manager', async () => {
    const removeSpy = vi.spyOn(fileStack, 'remove').mockResolvedValue();
    const remapSpy = vi.spyOn(fileStack, 'remap').mockResolvedValue();
    const reorderSpy = vi.spyOn(fileStack, 'reorder');
    setProcessorStack([
      {
        detectedLanguage: 'en',
        name: 'players-a.html',
        rowCount: 5,
        type: 'complete'
      },
      {
        detectedLanguage: 'en',
        name: 'players-b.html',
        rowCount: 4,
        type: 'stats'
      }
    ]);
    useWorkspaceStore.getState().openFileManager();

    act(() => {
      root.render(createElement(FileManagerModal));
    });

    const remapButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="file_manager_remap_headers"]'
    );
    const removeButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="file_manager_remove_file"]'
    );
    const moveDownButton = container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label="file_manager_move_down"]'
    )[0];

    await act(async () => {
      remapButton?.click();
      await Promise.resolve();
    });
    await act(async () => {
      removeButton?.click();
      await Promise.resolve();
    });
    act(() => {
      moveDownButton?.click();
    });

    expect(remapSpy).toHaveBeenCalledWith(0);
    expect(removeSpy).toHaveBeenCalledWith(0);
    expect(reorderSpy).toHaveBeenCalledWith(0, 1);
  });
});
