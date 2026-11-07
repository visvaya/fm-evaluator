// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { continueImportFlowProcessingMock } = vi.hoisted(() => ({
  continueImportFlowProcessingMock: vi.fn()
}));

vi.mock('../lib/legacyActionBridge', () => ({
  continueImportFlowProcessing: continueImportFlowProcessingMock
}));

import { FileStackManager } from './fileStack';

// Mock global dependencies
const mockProcessor = {
  attributes: [] as any[],
  fileStack: [] as any[],
  normalizeHeader: vi.fn((h) => h.trim().toLowerCase()),
  parseHTML: vi.fn(),
  processFiles: vi.fn(),
  stats: [] as any[]
};

const mockI18n = {
  t: vi.fn((key) => key)
};

const mockTableState = {
  restoreState: vi.fn(),
  saveState: vi.fn()
};

// Mock window globals
vi.stubGlobal('processor', mockProcessor);
vi.stubGlobal('i18n', mockI18n);
vi.stubGlobal('tableState', mockTableState);
vi.stubGlobal('renderFileStack', vi.fn());

// Mock DOM
function createMockDOM() {
  document.body.innerHTML = `
    <div id="file-stack" class="hidden"></div>
    <div id="file-stack-modal" class="hidden"></div>
    <div id="merge-mode-selection" class="hidden"></div>
    <div id="upload-mode-description"></div>
    <div id="loading-overlay" style="display: none;"></div>
    <div id="error-log" class="hidden"><span class="error-log-content"></span></div>
  `;
}

describe('FileStackManager', () => {
  let fileStackManager: FileStackManager;

  beforeEach(() => {
    createMockDOM();
    mockProcessor.fileStack = [];
    vi.clearAllMocks();
    continueImportFlowProcessingMock.mockReset();
    fileStackManager = new FileStackManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('render', () => {
    it('should show message when stack is empty', () => {
      fileStackManager.render('file-stack');
      const container = document.querySelector('#file-stack');
      expect(container?.innerHTML).toBe('');
      expect(container?.classList.contains('hidden')).toBe(true);
    });

    it('should render file cards when stack has files', () => {
      mockProcessor.fileStack = [{ name: 'test1.html', rowCount: 100, type: 'complete' }];
      fileStackManager.render('file-stack');
      const container = document.querySelector('#file-stack');
      expect(container?.classList.contains('hidden')).toBe(false);
      expect(container?.querySelectorAll('.file-card').length).toBe(1);
    });
  });

  describe('remove', () => {
    it('should remove file from processor stack', async () => {
      mockProcessor.fileStack = [
        { name: 'file1', parsedData: [] },
        { name: 'file2', parsedData: [] }
      ];

      await fileStackManager.remove(0);

      expect(mockProcessor.fileStack).toHaveLength(1);
      expect(mockProcessor.fileStack[0].name).toBe('file2');
    });

    it('should reconstruct attributes and stats after removal', async () => {
      mockProcessor.fileStack = [
        { name: 'file1', parsedData: [{ id: 1 }], type: 'attr' },
        { name: 'file2', parsedData: [{ id: 2 }], type: 'attr' }
      ];

      await fileStackManager.remove(0);

      // fileStackManager.remove logic:
      // 1. splice
      // 2. clear attributes/stats
      // 3. rebuild from stack

      // Since we mocked processor, the manager modifies the mock.
      // We need to ensure logic in manager actually pushes to processor.attributes

      expect(mockProcessor.attributes).toHaveLength(1);
      // Note: In actual implementation it iterates and pushes.
      // Our mock processor needs to behave like an object reference.
    });

    it('continues import flow through the explicit bridge after removal', async () => {
      mockProcessor.fileStack = [{ name: 'file1', parsedData: [], type: 'attr' }];

      await fileStackManager.remove(0);

      expect(continueImportFlowProcessingMock).toHaveBeenCalledTimes(1);
    });
  });
});
