declare const Cropper: any;

import {
  currentCropImage,
  currentSelectionStep,
  ocrAreas,
  pendingFiles,
  saveOCRAreas,
  setCurrentCropImage,
  setCurrentSelectionStep,
  setOcrAreas,
  setPendingFiles
} from '../ocr/ocrSettings';

let cropper: any = null;

export function destroyCropper(): void {
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
}

export function cancelCropArea(): void {
  document.querySelector('#cropModal')?.classList.add('hidden');
  destroyCropper();
  setCurrentCropImage(null);
  setCurrentSelectionStep(0);
  setOcrAreas({ league: null, table: null });
  setPendingFiles([]);
  const ocrFileInput = document.querySelector<HTMLInputElement>('#possession-ocr-file');
  if (ocrFileInput) ocrFileInput.value = '';
}

export function confirmCropArea(onProcess: (files: File[]) => Promise<void>): void {
  if (!cropper) return;
  const cropBoxData = cropper.getCropBoxData();
  const canvasData = cropper.getCanvasData();
  const imageData = cropper.getImageData();
  const scaleX = imageData.naturalWidth / imageData.width;
  const scaleY = imageData.naturalHeight / imageData.height;
  const originalArea = {
    height: Math.round(cropBoxData.height * scaleY),
    width: Math.round(cropBoxData.width * scaleX),
    x: Math.round((cropBoxData.left - canvasData.left) * scaleX),
    y: Math.round((cropBoxData.top - canvasData.top) * scaleY)
  };

  if (currentSelectionStep === 0) {
    setOcrAreas({ ...ocrAreas, league: originalArea });
    setCurrentSelectionStep(1);
    const cropModalTitle = document.querySelector('#crop-modal-title');
    const instructionText = document.querySelector('#crop-instruction-text');
    if (cropModalTitle)
      cropModalTitle.innerHTML =
        '<i class="fas fa-crop-alt mr-2"></i>Zaznacz obszar obejmujący nazwy klubów i wartości ich średniego posiadania piłki';
    if (instructionText)
      instructionText.textContent =
        'Krok 2/2: Zaznacz obszar wyłącznie z nazwami klubów i wartościami kolumny Avg. Poss. Nie ma potrzeby zaznaczania herbów i nazw nagłówków. Użyj rolki myszy aby przybliżyć | Przesuwaj myszką | Przeciągnij rogi aby zmienić rozmiar';
    destroyCropper();
    if (currentCropImage) setupAreaSelectionWithCropper(currentCropImage).catch(() => {});
  } else {
    setOcrAreas({ ...ocrAreas, table: originalArea });
    setCurrentSelectionStep(2);
    const cropModal = document.querySelector('#cropModal');
    if (cropModal) cropModal.classList.add('hidden');
    destroyCropper();
    saveOCRAreas();
    document.querySelector('#change-ocr-areas')?.classList.remove('hidden');
    if (pendingFiles.length > 0) {
      void onProcess(pendingFiles);
      setPendingFiles([]);
    }
  }
}

export function setupAreaSelectionWithCropper(file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', (evt) => {
      destroyCropper();
      if ((window as any).ocrCropper) {
        (window as any).ocrCropper.destroy();
        (window as any).ocrCropper = null;
      }

      const imageElement = document.querySelector<HTMLImageElement>('#imageToCrop');
      const cropModal = document.querySelector('#cropModal');
      if (!imageElement || !cropModal) {
        reject(new Error('Elementy modala nie znaleziono'));
        return;
      }

      imageElement.src = (evt.target as FileReader).result as string;
      imageElement.style.display = 'block';
      cropModal.classList.remove('hidden');
      setCurrentCropImage(file);

      const cropModalTitle = document.querySelector('#crop-modal-title');
      const instructionText = document.querySelector('#crop-instruction-text');
      if (currentSelectionStep === 0) {
        if (cropModalTitle)
          cropModalTitle.innerHTML =
            '<i class="fas fa-crop-alt mr-2"></i>Zaznacz obszar obejmujący nazwę ligi w nagłówku';
        if (instructionText)
          instructionText.textContent =
            'Krok 1/2: Zaznacz obszar wyłącznie z nazwą ligi z nagłówka (bez informacji o ostatnim zwycięzcy). Pamiętaj o pozostawieniu marginesu po prawej stronie na wypadek dłuższych nazw. Użyj rolki myszy aby przybliżyć | Przesuwaj myszką | Przeciągnij rogi aby zmienić rozmiar';
      } else {
        if (cropModalTitle)
          cropModalTitle.innerHTML =
            '<i class="fas fa-crop-alt mr-2"></i>Zaznacz obszar obejmujący nazwy klubów i wartości ich średniego posiadania piłki';
        if (instructionText)
          instructionText.textContent =
            'Krok 2/2: Zaznacz obszar wyłącznie z nazwami klubów i wartościami kolumny Avg. Poss. Nie ma potrzeby zaznaczania herbów i nazw nagłówków. Użyj rolki myszy aby przybliżyć | Przesuwaj myszką | Przeciągnij rogi aby zmienić rozmiar';
      }

      cropper = new Cropper(imageElement, {
        aspectRatio: NaN,
        autoCropArea: 0.3,
        center: true,
        cropBoxMovable: true,
        cropBoxResizable: true,
        dragMode: 'move',
        guides: true,
        highlight: false,
        ready() {
          (window as any).ocrCropper = cropper;
          resolve();
        },
        restore: false,
        scalable: true,
        toggleDragModeOnDblclick: false,
        viewMode: 1,
        zoomable: true
      });
    });
    reader.onerror = () => reject(new Error('Nie udało się wczytać obrazu'));
    reader.readAsDataURL(file);
  });
}
