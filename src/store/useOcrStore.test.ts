import { beforeEach, describe, it, expect } from 'vitest';
import { useOcrStore } from './useOcrStore';
import type { OCRResult } from '../ocr/ocrParsing';

function makeResult(id: string, extra: Partial<OCRResult> = {}): OCRResult {
  return { _resultId: id, matched: 'Club A', possession: 55, ...extra } as OCRResult;
}

describe('useOcrStore', () => {
  beforeEach(() => {
    useOcrStore.getState().clearOcrData();
  });

  it('starts with empty state', () => {
    const s = useOcrStore.getState();
    expect(s.ocrResults).toEqual([]);
    expect(s.ocrErrors).toEqual([]);
    expect(s.ocrFileErrors).toEqual([]);
  });

  it('setOcrData replaces all three fields', () => {
    const results = [makeResult('r1')];
    const errors = [{ original: 'x' }];
    const fileErrors = ['file.png: error'];
    useOcrStore.getState().setOcrData(results, errors, fileErrors);
    const s = useOcrStore.getState();
    expect(s.ocrResults).toEqual(results);
    expect(s.ocrErrors).toEqual(errors);
    expect(s.ocrFileErrors).toEqual(fileErrors);
  });

  it('updateOcrResult updates matched name and possession immutably', () => {
    useOcrStore.getState().setOcrData([makeResult('r1'), makeResult('r2')], [], []);
    const before = useOcrStore.getState().ocrResults[0];
    useOcrStore.getState().updateOcrResult('r1', { matched: 'New Club', possession: 60 });
    const after = useOcrStore.getState().ocrResults;
    expect(after[0].matched).toBe('New Club');
    expect(after[0].possession).toBe(60);
    expect(after[1].matched).toBe('Club A');
    expect(after[0]).not.toBe(before);
  });

  it('updateOcrResult is a no-op for unknown resultId', () => {
    useOcrStore.getState().setOcrData([makeResult('r1')], [], []);
    useOcrStore.getState().updateOcrResult('unknown', { matched: 'X' });
    expect(useOcrStore.getState().ocrResults[0].matched).toBe('Club A');
  });

  it('removeOcrResult removes matching entry', () => {
    useOcrStore.getState().setOcrData([makeResult('r1'), makeResult('r2')], [], []);
    useOcrStore.getState().removeOcrResult('r1');
    const results = useOcrStore.getState().ocrResults;
    expect(results).toHaveLength(1);
    expect(results[0]._resultId).toBe('r2');
  });

  it('clearOcrData resets to empty', () => {
    useOcrStore.getState().setOcrData([makeResult('r1')], [{}], ['err']);
    useOcrStore.getState().clearOcrData();
    const s = useOcrStore.getState();
    expect(s.ocrResults).toEqual([]);
    expect(s.ocrErrors).toEqual([]);
    expect(s.ocrFileErrors).toEqual([]);
  });
});
