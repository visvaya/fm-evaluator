// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useOcrStore } from '../store/useOcrStore';

vi.mock('@/features/legacyRuntime/legacyActionAttributes', () => ({
  legacyResultActionAttrs: (_action: string, id: string) =>
    `data-fm-action="${_action}" data-fm-id="${id}"`
}));

vi.mock('../ocr/ocrMatching', () => ({
  correctCommonOCRErrors: (s: string) => s
}));

vi.mock('./possessionClubList', () => ({
  renderPossessionClubList: vi.fn()
}));

import { renderPossessionClubList } from './possessionClubList';
import {
  displayOCRResults,
  editOCRResult,
  formatOCRResult,
  refreshOCRResultsDisplay,
  removeOCRResult
} from './possessionOCRDisplay';

import type { OCRResult } from '../ocr/ocrParsing';

function makeResult(overrides: Partial<OCRResult> = {}): OCRResult {
  return {
    matched: 'Legia',
    original: 'Legia',
    possession: 55,
    sourceFile: 'test.png',
    league: 'PKO BP Ekstraklasa',
    ...overrides
  } as OCRResult;
}

function makeContainer() {
  const container = document.createElement('div');
  container.id = 'ocr-preview-container';
  container.classList.add('hidden');
  const text = document.createElement('div');
  text.id = 'ocr-preview-text';
  container.appendChild(text);
  document.body.appendChild(container);
}

describe('possessionOCRDisplay', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    useOcrStore.getState().clearOcrData();
    (window as any).processor = null;
    vi.clearAllMocks();
  });

  describe('formatOCRResult', () => {
    it('returns HTML string containing matched name and possession', () => {
      const r = makeResult();
      const html = formatOCRResult(r, 0);
      expect(html).toContain('Legia');
      expect(html).toContain('55%');
    });

    it('assigns _resultId to the result object', () => {
      const r = makeResult();
      formatOCRResult(r, 0);
      expect(r._resultId).toBeTruthy();
      expect(typeof r._resultId).toBe('string');
    });

    it('includes data-fm-action attributes for edit and remove', () => {
      const r = makeResult();
      const html = formatOCRResult(r, 0);
      expect(html).toContain('data-fm-action="editOCRResult"');
      expect(html).toContain('data-fm-action="removeOCRResult"');
    });

    it('uses orange class for lowConfidenceWarning', () => {
      const r = makeResult({ lowConfidenceWarning: true });
      const html = formatOCRResult(r, 0);
      expect(html).toContain('text-orange-600');
    });

    it('uses orange class when ocrConfidence < 60', () => {
      const r = makeResult({ ocrConfidence: 45 });
      const html = formatOCRResult(r, 1);
      expect(html).toContain('text-orange-600');
      expect(html).toContain('niska pewno');
    });

    it('uses blue class for corrected result', () => {
      const r = makeResult({ corrected: true });
      const html = formatOCRResult(r, 2);
      expect(html).toContain('text-blue-600');
    });

    it('escapes HTML in matched name', () => {
      const r = makeResult({ matched: '<script>alert(1)</script>', original: '<script>' });
      const html = formatOCRResult(r, 3);
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('shows OCR correction chain when correctedOCR differs from original', () => {
      const r = makeResult({ original: 'Legla', correctedOCR: 'Legia', matched: 'Legia' });
      const html = formatOCRResult(r, 4);
      expect(html).toContain('Legla');
    });
  });

  describe('displayOCRResults', () => {
    it('sets ocrResults in store', () => {
      makeContainer();
      const results = [makeResult()];
      displayOCRResults(results, [], [], false);
      expect(useOcrStore.getState().ocrResults).toEqual(results);
    });

    it('reveals the preview container', () => {
      makeContainer();
      displayOCRResults([makeResult()], [], [], false);
      expect(document.querySelector('#ocr-preview-container')?.classList.contains('hidden')).toBe(
        false
      );
    });

    it('renders each result in preview text', () => {
      makeContainer();
      const results = [
        makeResult({ matched: 'Legia', possession: 60 }),
        makeResult({ matched: 'Lech', possession: 40, sourceFile: 'test.png' })
      ];
      displayOCRResults(results, [], [], false);
      const text = document.querySelector('#ocr-preview-text')?.textContent ?? '';
      expect(text).toContain('Legia');
      expect(text).toContain('Lech');
    });

    it('groups by file when multipleFiles is true', () => {
      makeContainer();
      const results = [
        makeResult({ matched: 'Legia', sourceFile: 'file1.png' }),
        makeResult({ matched: 'Lech', sourceFile: 'file2.png' })
      ];
      displayOCRResults(results, [], [], true);
      const text = document.querySelector('#ocr-preview-text')?.textContent ?? '';
      expect(text).toContain('file1.png');
      expect(text).toContain('file2.png');
    });

    it('shows unrecognized line count when errors present', () => {
      makeContainer();
      displayOCRResults([], [{ line: 'foo' }, { line: 'bar' }], [], false);
      expect(document.querySelector('#ocr-preview-text')?.textContent).toContain('2');
    });

    it('does nothing when container elements are missing', () => {
      expect(() => displayOCRResults([makeResult()], [], [], false)).not.toThrow();
    });
  });

  describe('refreshOCRResultsDisplay', () => {
    it('does nothing when currentOCRResults is not set', () => {
      makeContainer();
      expect(() => refreshOCRResultsDisplay()).not.toThrow();
    });

    it('re-renders when ocrResults is set in store', () => {
      makeContainer();
      const results = [makeResult({ matched: 'Wisla', possession: 45 })];
      useOcrStore.getState().setOcrData(results, [], []);
      refreshOCRResultsDisplay();
      expect(document.querySelector('#ocr-preview-text')?.textContent).toContain('Wisla');
    });
  });

  describe('removeOCRResult', () => {
    it('removes the matching result from the store', () => {
      makeContainer();
      const r1 = makeResult({ matched: 'Legia', possession: 60 });
      const r2 = makeResult({ matched: 'Lech', possession: 40 });
      formatOCRResult(r1, 0);
      formatOCRResult(r2, 1);
      useOcrStore.getState().setOcrData([r1, r2], [], []);
      (window as any).processor = {
        removeTeamPossession: vi.fn()
      };
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      removeOCRResult(r1._resultId!);

      const results = useOcrStore.getState().ocrResults;
      expect(results).toHaveLength(1);
      expect(results[0].matched).toBe('Lech');
    });

    it('calls processor.removeTeamPossession with matched name', () => {
      makeContainer();
      const r = makeResult({ matched: 'Cracovia', possession: 50 });
      formatOCRResult(r, 0);
      const removeFn = vi.fn();
      useOcrStore.getState().setOcrData([r], [], []);
      (window as any).processor = { removeTeamPossession: removeFn };
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      removeOCRResult(r._resultId!);

      expect(removeFn).toHaveBeenCalledWith('Cracovia');
    });

    it('aborts when confirm returns false', () => {
      const r = makeResult();
      formatOCRResult(r, 0);
      useOcrStore.getState().setOcrData([r], [], []);
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      removeOCRResult(r._resultId!);

      expect(useOcrStore.getState().ocrResults).toHaveLength(1);
    });

    it('calls renderPossessionClubList after removal', () => {
      makeContainer();
      const r = makeResult();
      formatOCRResult(r, 0);
      useOcrStore.getState().setOcrData([r], [], []);
      (window as any).processor = { removeTeamPossession: vi.fn() };
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      removeOCRResult(r._resultId!);

      expect(renderPossessionClubList).toHaveBeenCalled();
    });
  });

  describe('editOCRResult', () => {
    it('alerts when result not found', () => {
      vi.spyOn(window, 'alert').mockImplementation(() => {});
      editOCRResult('nonexistent-id');
      expect(window.alert).toHaveBeenCalled();
    });

    it('updates matched and possession after prompt', () => {
      makeContainer();
      const r = makeResult({ matched: 'Legia', possession: 55 });
      formatOCRResult(r, 0);
      useOcrStore.getState().setOcrData([r], [], []);
      (window as any).processor = { setTeamPossession: vi.fn() };

      vi.spyOn(window, 'prompt').mockReturnValueOnce('Wisla').mockReturnValueOnce('65');

      editOCRResult(r._resultId!);

      const updated = useOcrStore.getState().ocrResults[0];
      expect(updated.matched).toBe('Wisla');
      expect(updated.possession).toBe(65);
      expect(updated.manuallyEdited).toBe(true);
    });

    it('aborts when first prompt is cancelled', () => {
      const r = makeResult();
      formatOCRResult(r, 0);
      useOcrStore.getState().setOcrData([r], [], []);
      vi.spyOn(window, 'prompt').mockReturnValueOnce(null);

      editOCRResult(r._resultId!);

      expect(useOcrStore.getState().ocrResults[0].matched).toBe('Legia');
    });

    it('shows alert for invalid possession value', () => {
      const r = makeResult();
      formatOCRResult(r, 0);
      useOcrStore.getState().setOcrData([r], [], []);
      vi.spyOn(window, 'prompt').mockReturnValueOnce('Legia').mockReturnValueOnce('150');
      vi.spyOn(window, 'alert').mockImplementation(() => {});

      editOCRResult(r._resultId!);

      expect(window.alert).toHaveBeenCalled();
    });
  });
});
