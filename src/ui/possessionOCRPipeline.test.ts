// @vitest-environment jsdom
import { beforeEach, describe, it, expect, vi } from 'vitest';

import { processWithConcurrencyLimit } from './possessionOCRPipeline';

// jsdom doesn't implement canvas – provide a no-op context globally for this file
const mockCtx = { drawImage: vi.fn() };
HTMLCanvasElement.prototype.getContext = () => mockCtx as any;

vi.mock('../ocr/ocrSettings', () => ({
  ocrAreas: { league: null, table: null },
  ocrSettings: { confidenceThreshold: 60 }
}));

vi.mock('../ocr/ocrImageProcessing', () => ({
  cropImage: vi.fn().mockReturnValue(document.createElement('canvas')),
  preprocessImageForOCRFromCanvas: vi.fn().mockResolvedValue(document.createElement('canvas'))
}));

vi.mock('../ocr/ocrWorkerPool', () => ({
  ocrWorkerPool: {
    recognize: vi.fn().mockResolvedValue({ data: { text: 'Arsenal 55%' }, confidence: 80 })
  }
}));

vi.mock('../ocr/ocrParsing', () => ({
  parseOCRText: vi.fn(),
  updateReferenceDatabase: vi.fn()
}));

vi.mock('../ocr/ocrMatching', () => ({
  normalizeTextForMatching: vi.fn((s: string) => s.toLowerCase().trim())
}));

vi.mock('./possessionOCRDisplay', () => ({
  displayOCRResults: vi.fn()
}));

vi.mock('./possessionClubList', () => ({
  renderPossessionClubList: vi.fn()
}));

function mockImageConstructor() {
  (global as any).Image = class {
    addEventListener(event: string, cb: () => void) {
      if (event === 'load') setTimeout(cb, 0);
    }
    set src(_: string) {}
    onerror = null;
    width = 800;
    height = 600;
  };
  global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
  global.URL.revokeObjectURL = vi.fn();
}

describe('processWithConcurrencyLimit', () => {
  it('processes all items and returns array results', async () => {
    const { results, errors } = await processWithConcurrencyLimit([1, 2, 3], 2, async (item) => [
      item * 2
    ]);
    expect(errors).toHaveLength(0);
    expect(results).toHaveLength(3);
    expect(results.map((r) => r.result)).toEqual([[2], [4], [6]]);
  });

  it('collects errors without failing the entire batch', async () => {
    const { results, errors } = await processWithConcurrencyLimit([1, 2, 3], 2, async (item) => {
      if (item === 2) throw new Error('fail');
      return [item];
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].index).toBe(1);
    expect(errors[0].error.message).toBe('fail');
    expect(results).toHaveLength(2);
  });

  it('preserves item indices in results', async () => {
    const { results } = await processWithConcurrencyLimit(['a', 'b', 'c'], 3, async (item) => [
      item.toUpperCase()
    ]);
    expect(results.find((r) => r.index === 0)?.result).toEqual(['A']);
    expect(results.find((r) => r.index === 2)?.result).toEqual(['C']);
  });

  it('never runs more items at once than the limit', async () => {
    const running = { now: 0, peak: 0 };
    await processWithConcurrencyLimit([40, 0, 0, 0, 0, 0], 2, async (delayMs) => {
      running.now += 1;
      running.peak = Math.max(running.peak, running.now);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      running.now -= 1;
      return [delayMs];
    });
    expect(running.peak).toBe(2);
  });

  it('handles empty items array', async () => {
    const { results, errors } = await processWithConcurrencyLimit([], 2, async (item) => [item]);
    expect(results).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it('does not push non-array results to results list', async () => {
    const { results, errors } = await processWithConcurrencyLimit(
      [1],
      1,
      async () => 42 // non-array – should be ignored
    );
    expect(results).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
});

describe('processPossessionScreenshotWithAreas', () => {
  it('throws when ocrAreas are not defined', async () => {
    const { processPossessionScreenshotWithAreas } = await import('./possessionOCRPipeline');
    const file = new File([''], 'test.png', { type: 'image/png' });

    await expect(processPossessionScreenshotWithAreas(file)).rejects.toThrow(
      'Obszary OCR nie są zdefiniowane'
    );
  });

  it('sets lowConfidenceWarning when confidence below threshold', async () => {
    const { ocrAreas } = await import('../ocr/ocrSettings');
    const { ocrWorkerPool } = await import('../ocr/ocrWorkerPool');
    const { parseOCRText } = await import('../ocr/ocrParsing');

    (ocrAreas as any).league = { x: 0, y: 0, width: 100, height: 50 };
    (ocrAreas as any).table = { x: 0, y: 50, width: 100, height: 200 };
    (ocrWorkerPool.recognize as any).mockResolvedValue({
      data: { text: 'text' },
      confidence: 40
    });
    (parseOCRText as any).mockReturnValue({
      results: [{ matched: 'Arsenal', possession: 55, ocrLeague: null }],
      errors: [],
      league: null
    });
    mockImageConstructor();

    const { processPossessionScreenshotWithAreas } = await import('./possessionOCRPipeline');
    const file = new File([''], 'test.png', { type: 'image/png' });
    const results = await processPossessionScreenshotWithAreas(file);

    expect(results[0].lowConfidenceWarning).toBe(true);
  });

  it('returns empty array when parseOCRText returns no results', async () => {
    const { ocrAreas } = await import('../ocr/ocrSettings');
    const { parseOCRText } = await import('../ocr/ocrParsing');

    (ocrAreas as any).league = { x: 0, y: 0, width: 100, height: 50 };
    (ocrAreas as any).table = { x: 0, y: 50, width: 100, height: 200 };
    (parseOCRText as any).mockReturnValue({ results: [], errors: [], league: null });
    mockImageConstructor();

    const { processPossessionScreenshotWithAreas } = await import('./possessionOCRPipeline');
    const file = new File([''], 'test.png', { type: 'image/png' });
    const results = await processPossessionScreenshotWithAreas(file);

    expect(results).toEqual([]);
  });
});

function buildOCRProgressDOM() {
  [
    'ocr-progress-container',
    'ocr-progress-bar',
    'ocr-progress-text',
    'possession-modal-error',
    'ocr-preview-container'
  ].forEach((id) => {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.id = id;
    if (id === 'ocr-progress-container') el.classList.add('hidden');
    document.body.appendChild(el);
  });
  const existingInput = document.getElementById('possession-ocr-file');
  if (existingInput) existingInput.remove();
  const input = document.createElement('input');
  input.type = 'file';
  input.id = 'possession-ocr-file';
  document.body.appendChild(input);
}

describe('processOCRFiles', () => {
  beforeEach(() => {
    buildOCRProgressDOM();
    vi.clearAllMocks();
    (global as any).window = Object.assign(global.window || {}, { processor: null });
  });

  it('returns early without DOM changes when files array is empty', async () => {
    const { processOCRFiles } = await import('./possessionOCRPipeline');
    await processOCRFiles([]);

    const progress = document.getElementById('ocr-progress-container');
    expect(progress?.classList.contains('hidden')).toBe(true);
  });

  it('catches top-level errors and shows error message', async () => {
    const { updateReferenceDatabase } = await import('../ocr/ocrParsing');
    (updateReferenceDatabase as any).mockImplementation(() => {
      throw new Error('OCR init failed');
    });

    const { processOCRFiles } = await import('./possessionOCRPipeline');
    const file = new File([''], 'test.png', { type: 'image/png' });
    await processOCRFiles([file]);

    const errorEl = document.getElementById('possession-modal-error');
    expect(errorEl?.textContent).toContain('Błąd OCR: OCR init failed');
  });

  it('shows "Nie znaleziono" when all files produce empty results', async () => {
    const { updateReferenceDatabase, parseOCRText } = await import('../ocr/ocrParsing');
    (updateReferenceDatabase as any).mockReturnValue(undefined);

    const { ocrAreas } = await import('../ocr/ocrSettings');
    (ocrAreas as any).league = { x: 0, y: 0, width: 100, height: 50 };
    (ocrAreas as any).table = { x: 0, y: 50, width: 100, height: 200 };
    (parseOCRText as any).mockReturnValue({ results: [], errors: [], league: null });
    mockImageConstructor();

    const { processOCRFiles } = await import('./possessionOCRPipeline');
    const file = new File([''], 'test.png', { type: 'image/png' });
    await processOCRFiles([file]);

    const errorEl = document.getElementById('possession-modal-error');
    expect(errorEl?.textContent).toContain('Nie znaleziono żadnych danych');
  });
});
