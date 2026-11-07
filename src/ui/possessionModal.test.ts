// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/features/legacyRuntime/legacyActionAttributes', () => ({
  legacyClubActionAttrs: () => '',
  legacyResultActionAttrs: () => ''
}));

vi.mock('../lib/legacyActionBridge', () => ({
  rerunCurrentAnalysis: vi.fn()
}));

vi.mock('../ocr/ocrImageProcessing', () => ({
  cropImage: vi.fn(),
  preprocessImageForOCRFromCanvas: vi.fn()
}));

vi.mock('../ocr/ocrMatching', () => ({
  correctCommonOCRErrors: vi.fn(),
  normalizeTextForMatching: vi.fn((value: string) => value)
}));

vi.mock('../ocr/ocrParsing', () => ({
  parseOCRText: vi.fn(),
  updateReferenceDatabase: vi.fn()
}));

vi.mock('../ocr/ocrSettings', () => ({
  currentCropImage: null,
  currentSelectionStep: 0,
  loadOCRAreas: vi.fn(),
  ocrAreas: {},
  ocrSettings: {},
  pendingFiles: [],
  resetOCRAreas: vi.fn(),
  saveOCRAreas: vi.fn(),
  setCurrentCropImage: vi.fn(),
  setCurrentSelectionStep: vi.fn(),
  setOcrAreas: vi.fn(),
  setPendingFiles: vi.fn()
}));

vi.mock('../ocr/ocrWorkerPool', () => ({
  ocrWorkerPool: {}
}));

import { clearPlayerRuntimeRows, setPlayerRuntimeRows } from '@/lib/playerRuntimeCache';
import { useTableStore } from '@/store/useTableStore';

import { renderPossessionClubList } from './possessionClubList';

describe('possessionModal', () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="possession-club-list"></div>`;
    (window as any).collator = new Intl.Collator('pl', { numeric: true, sensitivity: 'base' });
    (window as any).normalizeDiacritics = (value: string) => value;
    (window as any).processor = {
      calculatedScores: [],
      getTeamPossession: (club: string) => (club === 'Legia' ? 55 : null),
      mergedData: [],
      teamPossessionMap: new Map(),
      normalizeClubName: (club: string) => club
    };
    clearPlayerRuntimeRows();
    useTableStore.setState({
      analysisReady: false,
      data: []
    });
  });

  it('renders clubs from shared runtime rows before analysis', () => {
    setPlayerRuntimeRows([
      { club: 'Legia', uid: '1' },
      { Club: 'Lech', uid: '2' }
    ] as any[]);

    renderPossessionClubList('');

    expect(document.querySelector('#possession-club-list')?.textContent).toContain('Legia');
    expect(document.querySelector('#possession-club-list')?.textContent).toContain('Lech');
    expect(document.querySelector('#possession-club-list')?.textContent).toContain('55%');
  });

  it('prefers analyzed store rows when analysis is ready', () => {
    setPlayerRuntimeRows([{ club: 'Imported Club', uid: 'imported' }] as any[]);
    useTableStore.setState({
      analysisReady: true,
      data: [{ club: 'Analyzed Club', uid: 'analyzed' }] as any[]
    });

    renderPossessionClubList('');

    const content = document.querySelector('#possession-club-list')?.textContent ?? '';
    expect(content).toContain('Analyzed Club');
    expect(content).not.toContain('Imported Club');
  });
});
