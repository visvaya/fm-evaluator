// @vitest-environment jsdom
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  attachFileStackDragDropMock,
  changePageMock,
  getFilteredDataMock,
  MockDataTransfer,
  processImportedFilesBatchMock,
  processorMock,
  renderActiveFileStackStateMock,
  reorderFileStackItemsMock,
  runAnalysisMock,
  scheduleTableRenderMock
} = vi.hoisted(() => {
  class MockDataTransferImpl {
    private _files: File[] = [];
    items = { add: (f: File) => this._files.push(f) };
    get files() {
      return this._files;
    }
  }
  return {
    attachFileStackDragDropMock: vi.fn(),
    changePageMock: vi.fn(),
    getFilteredDataMock: vi.fn(() => new Array(40).fill({})),
    MockDataTransfer: MockDataTransferImpl,
    processImportedFilesBatchMock: vi.fn().mockResolvedValue({
      cancelled: false,
      errors: [],
      failedFiles: [],
      filesWithErrors: new Map(),
      loadedTypes: [],
      processedCount: 0
    }),
    processorMock: {
      attributes: [],
      detectedFileLanguages: [],
      fileStack: [] as Record<string, unknown>[],
      parseHTML: vi.fn().mockResolvedValue({}),
      stats: []
    },
    renderActiveFileStackStateMock: vi.fn(),
    reorderFileStackItemsMock: vi.fn(),
    runAnalysisMock: vi.fn(),
    scheduleTableRenderMock: vi.fn()
  };
});

vi.mock('../ui/tableOrchestrator', () => ({
  changePage: changePageMock,
  runAnalysis: runAnalysisMock,
  scheduleTableRender: scheduleTableRenderMock
}));

vi.mock('../ui/filterData', () => ({
  getFilteredData: getFilteredDataMock
}));

vi.mock('./dataProcessor', () => ({
  processor: processorMock
}));

vi.mock('./importRuntime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./importRuntime')>();
  return {
    ...actual,
    // The real one waits up to 2 s for parsed collections that these mocks never produce, which
    // outlived the test and touched window after teardown.
    continueImportAfterParsing: vi.fn().mockResolvedValue(undefined),
    processImportedFilesBatch: processImportedFilesBatchMock
  };
});

vi.mock('../ui/dragDrop', () => ({
  setupFileStackDragAndDrop: vi.fn()
}));

vi.mock('../ui/fileStackCards', () => ({
  fileStackTypeLabels: { modal: {} },
  renderFileStackCards: vi.fn(() => '<div class="file-card"></div>')
}));

vi.mock('../ui/fileStackState', () => ({
  reorderFileStackItems: reorderFileStackItemsMock
}));

vi.mock('../ui/fileStackUi', () => ({
  attachFileStackDragDrop: attachFileStackDragDropMock,
  renderActiveFileStackState: renderActiveFileStackStateMock
}));

vi.mock('../lib/legacyActionBridge', () => ({
  continueImportFlowProcessing: vi.fn(),
  rerunCurrentAnalysis: vi.fn()
}));

// The first import of handleFiles transforms its whole module graph; under machine load that took
// longer than the default test timeout, so the import is warmed once with its own hook timeout.
const MODULE_IMPORT_TIMEOUT_MS = 60_000;

describe('handleFiles pagination bridge', () => {
  beforeAll(async () => {
    await import('./handleFiles');
  }, MODULE_IMPORT_TIMEOUT_MS);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    processorMock.attributes = [];
    processorMock.detectedFileLanguages = [];
    processorMock.fileStack = [];
    processorMock.parseHTML = vi.fn().mockResolvedValue({});
    processorMock.stats = [];
    (global as any).DataTransfer = MockDataTransfer;
    document.body.innerHTML = `
      <select id="position-select"><option value="BEST">BEST</option></select>
      <select id="engine-select"><option value="FMTweak">FMTweak</option></select>
      <input id="rows-per-page" type="number" value="10" />
      <input id="page-number" type="number" value="1" />
      <button id="page-first"></button>
      <button id="page-prev"></button>
      <button id="page-next"></button>
      <button id="page-last"></button>
      <div id="retry-error-container" class="hidden"><button id="retry-files-btn"></button></div>
      <div id="file-stack-modal"></div>
      <div id="merge-mode-selection-modal" class="hidden"></div>
    `;
    (window as any).persistUIState = vi.fn();
  });

  it('routes page button clicks through imported changePage', async () => {
    await import('./handleFiles');

    document.getElementById('page-next')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(changePageMock).toHaveBeenCalledWith('next');
  });

  it('uses imported getFilteredData and scheduleTableRender for page input changes', async () => {
    const { store } = await import('../store/tableStore');
    store.rowsPerPage = 10;
    await import('./handleFiles');

    const pageNumberInput = document.getElementById('page-number') as HTMLInputElement;
    pageNumberInput.value = '3';
    pageNumberInput.dispatchEvent(new Event('blur', { bubbles: true }));

    expect(getFilteredDataMock).toHaveBeenCalled();
    expect(scheduleTableRenderMock).toHaveBeenCalled();
    expect(store.currentPage).toBe(3);
  });

  it('routes engine and position changes through imported runAnalysis', async () => {
    await import('./handleFiles');

    document
      .getElementById('position-select')
      ?.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('engine-select')?.dispatchEvent(new Event('change', { bubbles: true }));

    expect(runAnalysisMock).toHaveBeenCalledTimes(2);
  });

  it('routes file-stack modal reorder through shared file stack helpers', async () => {
    processorMock.fileStack = [
      { name: 'a.html', type: 'attr' },
      { name: 'b.html', type: 'stats' }
    ];
    let reorderCallback: null | ((from: number, to: number) => void) = null;
    attachFileStackDragDropMock.mockImplementation((_containerId, onReorder) => {
      reorderCallback = onReorder;
    });

    const module = await import('./handleFiles');
    module.renderFileStackModal();
    reorderCallback?.(0, 1);

    expect(renderActiveFileStackStateMock).toHaveBeenCalled();
    expect(attachFileStackDragDropMock).toHaveBeenCalledWith(
      'file-stack-modal',
      expect.any(Function)
    );
    expect(reorderFileStackItemsMock).toHaveBeenCalledWith(processorMock, 0, 1);
  });

  it('audits the cut cells of the files imported in this run only', async () => {
    const cutCells = [{ column: 'Notes', count: 2 }];
    processorMock.fileStack = [{ cutCells, name: 'earlier.html', type: 'attr' }];
    processImportedFilesBatchMock.mockImplementationOnce(() => {
      processorMock.fileStack.unshift({ cutCells, name: 'long.html', type: 'stats' });
      return Promise.resolve({
        cancelled: false,
        errors: [],
        failedFiles: [],
        filesWithErrors: new Map(),
        loadedTypes: [],
        processedCount: 1
      });
    });
    const addAudit = vi.fn();
    const auditWindow = window as unknown as { addAudit?: typeof addAudit };
    auditWindow.addAudit = addAudit;
    const module = await import('./handleFiles');

    await module.handleFiles([new File(['<table></table>'], 'long.html', { type: 'text/html' })]);

    expect(addAudit.mock.calls.filter(([event]) => event === 'file_cells_cut')).toEqual([
      ['file_cells_cut', { columns: cutCells, limitChars: 10_000, name: 'long.html' }, 'warn']
    ]);
    delete auditWindow.addAudit;
  });

  it('rewires duplicate retry button to re-trigger processing with force flag', async () => {
    processorMock.fileStack = [{ name: 'duplicate.html', type: 'attr' }];
    const addAudit = vi.fn();
    const auditWindow = window as unknown as { addAudit?: typeof addAudit };
    auditWindow.addAudit = addAudit;
    const finishedRuns = () =>
      addAudit.mock.calls.filter(([event]) => event === 'files_processing_finished').length;
    const module = await import('./handleFiles');

    await module.handleFiles([
      new File(['<table></table>'], 'duplicate.html', { type: 'text/html' })
    ]);

    expect(document.getElementById('retry-error-container')?.classList.contains('hidden')).toBe(
      false
    );

    // Clicking retry triggers handleFiles again with force=true, bypassing duplicate check
    processImportedFilesBatchMock.mockClear();
    document
      .getElementById('retry-files-btn')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // The click starts handleFiles without returning its promise. Wait until the retried run has
    // finished, so it cannot touch window after the test environment is torn down.
    await vi.waitFor(() => expect(finishedRuns()).toBe(2));

    expect(processImportedFilesBatchMock).toHaveBeenCalledTimes(1);
    delete auditWindow.addAudit;
  });
});
