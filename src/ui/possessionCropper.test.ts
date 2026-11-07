// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../ocr/ocrSettings', () => {
  let step = 0;
  let cropImage: any = null;
  let areas: any = { league: null, table: null };
  let pending: File[] = [];
  return {
    get currentSelectionStep() {
      return step;
    },
    get currentCropImage() {
      return cropImage;
    },
    get ocrAreas() {
      return areas;
    },
    get pendingFiles() {
      return pending;
    },
    saveOCRAreas: vi.fn(),
    resetOCRAreas: vi.fn(),
    setCurrentCropImage: vi.fn((v: any) => {
      cropImage = v;
    }),
    setCurrentSelectionStep: vi.fn((v: number) => {
      step = v;
    }),
    setOcrAreas: vi.fn((v: any) => {
      areas = v;
    }),
    setPendingFiles: vi.fn((v: File[]) => {
      pending = v;
    })
  };
});

import {
  saveOCRAreas,
  setCurrentCropImage,
  setCurrentSelectionStep,
  setOcrAreas,
  setPendingFiles
} from '../ocr/ocrSettings';

import {
  cancelCropArea,
  confirmCropArea,
  destroyCropper,
  setupAreaSelectionWithCropper
} from './possessionCropper';

function makeCropperDom() {
  const cropModal = document.createElement('div');
  cropModal.id = 'cropModal';
  document.body.appendChild(cropModal);
  const img = document.createElement('img');
  img.id = 'imageToCrop';
  document.body.appendChild(img);
  const title = document.createElement('div');
  title.id = 'crop-modal-title';
  document.body.appendChild(title);
  const instruction = document.createElement('div');
  instruction.id = 'crop-instruction-text';
  document.body.appendChild(instruction);
}

function makeMockCropper(overrides: Record<string, any> = {}) {
  return {
    destroy: vi.fn(),
    getCropBoxData: vi.fn(() => ({ height: 100, left: 10, top: 20, width: 200 })),
    getCanvasData: vi.fn(() => ({ left: 0, top: 0 })),
    getImageData: vi.fn(() => ({ height: 100, naturalHeight: 200, naturalWidth: 400, width: 200 })),
    ...overrides
  };
}

function makeFileReaderMock(result: string | Error = 'data:image/png;base64,x') {
  const listeners: Record<string, Array<(e: any) => void>> = {};
  let onerrorFn: ((e: any) => void) | null = null;
  const instance = {
    addEventListener: vi.fn((type: string, fn: (e: any) => void) => {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    }),
    readAsDataURL: vi.fn(() => {
      if (result instanceof Error) {
        if (onerrorFn) onerrorFn(new ProgressEvent('error'));
        return;
      }
      const fns = listeners['load'] || [];
      fns.forEach((fn) => fn({ target: { result } }));
    }),
    set onerror(fn: any) {
      onerrorFn = fn;
    }
  };
  return instance;
}

let frInstance: ReturnType<typeof makeFileReaderMock>;

function setupFileReaderMock(result: string | Error = 'data:image/png;base64,x') {
  frInstance = makeFileReaderMock(result);
  // Must use regular function so `new FileReader()` works – arrow functions aren't constructable
  (global as any).FileReader = vi.fn(function () {
    return frInstance;
  });
}

let mockCropperInstance: ReturnType<typeof makeMockCropper>;

function setupCropperMock(overrides: Record<string, any> = {}) {
  mockCropperInstance = makeMockCropper(overrides);
  // Must use regular function so `new Cropper(...)` works – arrow functions aren't constructable
  (global as any).Cropper = vi.fn(function (_el: any, opts: any) {
    if (opts?.ready) opts.ready.call(mockCropperInstance);
    return mockCropperInstance;
  });
}

beforeEach(() => {
  document.body.replaceChildren();
  // reset shared closure state in ocrSettings mock before clearing call records
  vi.mocked(setCurrentSelectionStep)(0);
  vi.mocked(setOcrAreas)({ league: null, table: null });
  vi.mocked(setPendingFiles)([]);
  vi.mocked(setCurrentCropImage)(null);
  vi.clearAllMocks();
  setupFileReaderMock();
  setupCropperMock();
});

describe('destroyCropper', () => {
  it('does not throw when no cropper is active', () => {
    expect(() => destroyCropper()).not.toThrow();
  });
});

describe('cancelCropArea', () => {
  it('hides crop modal', () => {
    const modal = document.createElement('div');
    modal.id = 'cropModal';
    modal.classList.remove('hidden');
    document.body.appendChild(modal);
    cancelCropArea();
    expect(modal.classList.contains('hidden')).toBe(true);
  });

  it('resets OCR settings', () => {
    cancelCropArea();
    expect(setCurrentCropImage).toHaveBeenCalledWith(null);
    expect(setCurrentSelectionStep).toHaveBeenCalledWith(0);
    expect(setOcrAreas).toHaveBeenCalledWith({ league: null, table: null });
    expect(setPendingFiles).toHaveBeenCalledWith([]);
  });

  it('clears file input value', () => {
    const fi = document.createElement('input');
    fi.id = 'possession-ocr-file';
    fi.value = 'some-file.png';
    document.body.appendChild(fi);
    cancelCropArea();
    expect(fi.value).toBe('');
  });

  it('calls destroy on active cropper', async () => {
    makeCropperDom();
    const file = new File(['x'], 'test.png', { type: 'image/png' });
    await setupAreaSelectionWithCropper(file);
    cancelCropArea();
    expect(mockCropperInstance.destroy).toHaveBeenCalled();
  });
});

describe('confirmCropArea step 0 (league selection)', () => {
  it('returns early when no cropper is active', () => {
    const onProcess = vi.fn().mockResolvedValue(undefined);
    expect(() => confirmCropArea(onProcess)).not.toThrow();
    expect(onProcess).not.toHaveBeenCalled();
  });

  it('does not call onProcess when step is 0', async () => {
    makeCropperDom();
    const file = new File(['x'], 'test.png', { type: 'image/png' });
    await setupAreaSelectionWithCropper(file);
    const onProcess = vi.fn().mockResolvedValue(undefined);
    confirmCropArea(onProcess);
    expect(onProcess).not.toHaveBeenCalled();
  });

  it('advances selection step to 1', async () => {
    makeCropperDom();
    const file = new File(['x'], 'test.png', { type: 'image/png' });
    await setupAreaSelectionWithCropper(file);
    vi.mocked(setCurrentSelectionStep).mockClear();
    confirmCropArea(vi.fn().mockResolvedValue(undefined));
    expect(setCurrentSelectionStep).toHaveBeenCalledWith(1);
  });

  it('sets league area with correct scaled coordinates', async () => {
    makeCropperDom();
    setupCropperMock({
      getCropBoxData: vi.fn(() => ({ height: 50, left: 20, top: 30, width: 100 })),
      getCanvasData: vi.fn(() => ({ left: 10, top: 10 })),
      getImageData: vi.fn(() => ({
        height: 200,
        naturalHeight: 400,
        naturalWidth: 600,
        width: 300
      }))
    });
    const file = new File(['x'], 'test.png', { type: 'image/png' });
    await setupAreaSelectionWithCropper(file);
    vi.mocked(setOcrAreas).mockClear();
    confirmCropArea(vi.fn().mockResolvedValue(undefined));
    expect(setOcrAreas).toHaveBeenCalledWith(
      expect.objectContaining({
        league: { height: 100, width: 200, x: 20, y: 40 }
      })
    );
  });
});

describe('confirmCropArea step 1 (table selection)', () => {
  it('calls saveOCRAreas and hides crop modal after step 1', async () => {
    makeCropperDom();
    const cropModal = document.querySelector('#cropModal')!;
    cropModal.classList.remove('hidden');
    const changeBtn = document.createElement('div');
    changeBtn.id = 'change-ocr-areas';
    changeBtn.classList.add('hidden');
    document.body.appendChild(changeBtn);

    const file = new File(['x'], 'test.png', { type: 'image/png' });
    const onProcess = vi.fn().mockResolvedValue(undefined);

    // run step 0 – advances closure step to 1
    await setupAreaSelectionWithCropper(file);
    confirmCropArea(onProcess);

    // run step 1 – closure step is now 1, so table path executes
    setupFileReaderMock();
    setupCropperMock();
    await setupAreaSelectionWithCropper(file);
    confirmCropArea(onProcess);

    expect(saveOCRAreas).toHaveBeenCalled();
    expect(cropModal.classList.contains('hidden')).toBe(true);
  });
});

describe('setupAreaSelectionWithCropper', () => {
  it('rejects when DOM elements are missing', async () => {
    const file = new File(['x'], 'test.png', { type: 'image/png' });
    await expect(setupAreaSelectionWithCropper(file)).rejects.toThrow('Elementy modala');
  });

  it('rejects on FileReader error', async () => {
    makeCropperDom();
    setupFileReaderMock(new Error('read error'));
    const file = new File(['x'], 'test.png', { type: 'image/png' });
    await expect(setupAreaSelectionWithCropper(file)).rejects.toThrow('Nie udało się wczytać');
  });

  it('reveals crop modal and calls setCurrentCropImage', async () => {
    makeCropperDom();
    const file = new File(['x'], 'test.png', { type: 'image/png' });
    await setupAreaSelectionWithCropper(file);
    expect(setCurrentCropImage).toHaveBeenCalledWith(file);
    expect(document.querySelector('#cropModal')?.classList.contains('hidden')).toBe(false);
  });

  it('sets image src from FileReader result', async () => {
    makeCropperDom();
    setupFileReaderMock('data:image/png;base64,TESTDATA');
    const file = new File(['x'], 'test.png', { type: 'image/png' });
    await setupAreaSelectionWithCropper(file);
    expect(document.querySelector<HTMLImageElement>('#imageToCrop')?.src).toContain('TESTDATA');
  });
});
