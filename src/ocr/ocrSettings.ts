// Phase 5F: OCR settings and area state – migrated from main.js

export interface OCRArea {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface OCRAreas {
  league: null | OCRArea;
  table: null | OCRArea;
}

export interface OCRSettings {
  concurrencyLimit: number;
  confidenceThreshold: number;
  load(): void;
  psmMode: string;
  quality: 'high' | 'low' | 'medium';
  save(): void;
}

const OCR_AREAS_KEY = 'fm_ocr_areas';
const OCR_SETTINGS_KEY = 'fm_ocr_settings';

export let ocrAreas: OCRAreas = { league: null, table: null };
export let currentSelectionStep = 0;
export let currentCropImage: File | null = null;
export let pendingFiles: File[] = [];

export function loadOCRAreas(): boolean {
  try {
    const saved = localStorage.getItem(OCR_AREAS_KEY);
    if (saved) {
      ocrAreas = JSON.parse(saved);
      return true;
    }
    ocrAreas = { league: null, table: null };
  } catch {
    ocrAreas = { league: null, table: null };
  }
  return false;
}

export function resetOCRAreas(): void {
  try {
    localStorage.removeItem(OCR_AREAS_KEY);
  } catch {
    /* ignore */
  }
  ocrAreas = { league: null, table: null };
  currentSelectionStep = 0;
  pendingFiles = [];
}

export function saveOCRAreas(): void {
  try {
    localStorage.setItem(OCR_AREAS_KEY, JSON.stringify(ocrAreas));
  } catch (error) {
    if ((window as any).addAudit)
      (window as any).addAudit('ocr_areas_save_error', { error: String(error) }, 'warn');
  }
}

export function setCurrentCropImage(file: File | null): void {
  currentCropImage = file;
}

export function setCurrentSelectionStep(step: number): void {
  currentSelectionStep = step;
}

export function setOcrAreas(areas: OCRAreas): void {
  ocrAreas = areas;
}

export function setPendingFiles(files: File[]): void {
  pendingFiles = files;
}

export const ocrSettings: OCRSettings = {
  concurrencyLimit: 2,
  confidenceThreshold: 60,
  load() {
    try {
      const saved = localStorage.getItem(OCR_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.assign(this, parsed);
      }
    } catch (error) {
      if ((window as any).addAudit)
        (window as any).addAudit('ocr_settings_load_error', { error: String(error) }, 'warn');
    }
  },
  psmMode: '6',

  quality: 'medium',

  save() {
    try {
      localStorage.setItem(
        OCR_SETTINGS_KEY,
        JSON.stringify({
          concurrencyLimit: this.concurrencyLimit,
          confidenceThreshold: this.confidenceThreshold,
          psmMode: this.psmMode,
          quality: this.quality
        })
      );
    } catch (error) {
      if ((window as any).addAudit)
        (window as any).addAudit('ocr_settings_save_error', { error: String(error) }, 'warn');
    }
  }
};

ocrSettings.load();
