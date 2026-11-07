import { create } from 'zustand';
import type { OCRResult } from '../ocr/ocrParsing';

interface OcrState {
  ocrResults: OCRResult[];
  ocrErrors: any[];
  ocrFileErrors: string[];
  setOcrData: (results: OCRResult[], errors: any[], fileErrors: string[]) => void;
  updateOcrResult: (resultId: string, updates: Partial<OCRResult>) => void;
  removeOcrResult: (resultId: string) => void;
  clearOcrData: () => void;
}

export const useOcrStore = create<OcrState>((set) => ({
  ocrResults: [],
  ocrErrors: [],
  ocrFileErrors: [],
  setOcrData: (ocrResults, ocrErrors, ocrFileErrors) =>
    set({ ocrResults, ocrErrors, ocrFileErrors }),
  updateOcrResult: (resultId, updates) =>
    set((state) => ({
      ocrResults: state.ocrResults.map((r) => (r._resultId === resultId ? { ...r, ...updates } : r))
    })),
  removeOcrResult: (resultId) =>
    set((state) => ({
      ocrResults: state.ocrResults.filter((r) => r._resultId !== resultId)
    })),
  clearOcrData: () => set({ ocrResults: [], ocrErrors: [], ocrFileErrors: [] })
}));
