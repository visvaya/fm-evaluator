import { describe, expect, it, vi } from 'vitest';

const {
  continueImportFlowProcessingMock,
  reportFileStackCriticalErrorMock,
  syncFileStackViewsMock
} = vi.hoisted(() => ({
  continueImportFlowProcessingMock: vi.fn(),
  reportFileStackCriticalErrorMock: vi.fn(),
  syncFileStackViewsMock: vi.fn((callback: () => void, _modal: () => void = () => {}) => callback())
}));

vi.mock('../lib/legacyActionBridge', () => ({
  continueImportFlowProcessing: continueImportFlowProcessingMock
}));

vi.mock('./fileStackUi', () => ({
  reportFileStackCriticalError: reportFileStackCriticalErrorMock,
  syncFileStackViews: syncFileStackViewsMock
}));

import {
  finalizeFileStackMutation,
  getExistingFileStackNames,
  getFileStackItems,
  getFileStackItem,
  handleFileStackCriticalError,
  hasFileStackItems,
  hasRemappableHtml,
  shouldAppendToFileStack
} from './fileStackRuntime';

describe('fileStackRuntime', () => {
  it('returns file-stack items or an empty array when missing', () => {
    expect(getFileStackItems({ fileStack: [{ html: '<table />' }] })).toEqual([
      { html: '<table />' }
    ]);
    expect(getFileStackItems({})).toEqual([]);
  });

  it('returns null for invalid file-stack indices', () => {
    expect(getFileStackItem({ fileStack: [{ html: '<table />' }] }, -1)).toBeNull();
    expect(getFileStackItem({ fileStack: [{ html: '<table />' }] }, 2)).toBeNull();
  });

  it('returns the requested file-stack item for valid indices', () => {
    const fileMeta = { html: '<table />' };
    expect(getFileStackItem({ fileStack: [fileMeta] }, 0)).toBe(fileMeta);
  });

  it('checks whether a file-stack item is remappable', () => {
    expect(hasRemappableHtml({ html: '<table />' })).toBe(true);
    expect(hasRemappableHtml({})).toBe(false);
    expect(hasRemappableHtml(null)).toBe(false);
  });

  it('reports whether file-stack items exist', () => {
    expect(hasFileStackItems({ fileStack: [{ html: '<table />' }] })).toBe(true);
    expect(hasFileStackItems({ fileStack: [] })).toBe(false);
  });

  it('collects existing file names from the file stack', () => {
    expect(
      getExistingFileStackNames({
        fileStack: [{ name: 'a.html' }, { name: 'b.html' }]
      })
    ).toEqual(new Set(['a.html', 'b.html']));
  });

  it('decides whether new files should append to the existing stack', () => {
    expect(shouldAppendToFileStack({ fileStack: [{ name: 'existing.html' }] }, 0)).toBe(true);
    expect(shouldAppendToFileStack({ fileStack: [] }, 1)).toBe(true);
    expect(shouldAppendToFileStack({ fileStack: [] }, 0)).toBe(false);
  });

  it('syncs views and continues import flow after a stack mutation', () => {
    const renderMain = vi.fn();

    finalizeFileStackMutation(renderMain);

    expect(syncFileStackViewsMock).toHaveBeenCalledTimes(1);
    expect(renderMain).toHaveBeenCalledTimes(1);
    expect(continueImportFlowProcessingMock).toHaveBeenCalledTimes(1);
  });

  it('reports critical errors through the shared UI helper', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => null);

    handleFileStackCriticalError(new Error('boom'));

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(reportFileStackCriticalErrorMock).toHaveBeenCalledWith('boom');
  });
});
