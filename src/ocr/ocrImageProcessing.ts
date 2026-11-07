// Phase 5F: Image preprocessing for OCR – migrated from main.js
import type { OCRArea } from './ocrSettings';

export function calculateOtsuThreshold(histogram: number[], totalPixels: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let maxVariance = 0,
    sumB = 0,
    threshold = 0,
    wB = 0,
    wF = 0;
  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    wF = totalPixels - wB;
    if (wF === 0) break;
    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }
  return threshold;
}

export function cropImage(sourceCanvas: HTMLCanvasElement, area: OCRArea): HTMLCanvasElement {
  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d');
  croppedCanvas.width = area.width;
  croppedCanvas.height = area.height;
  croppedCtx.drawImage(
    sourceCanvas,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    area.width,
    area.height
  );
  return croppedCanvas;
}

/**
 * OCR preprocessing step. Unused today; kept until the React/TS migration decides its fate.
 * @public
 */
export async function preprocessImageForOCR(imageFile: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    img.src = url;
    img.addEventListener('load', () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const threshold = 150;
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        const color = gray > threshold ? 0 : 255;
        data[i] = color;
        data[i + 1] = color;
        data[i + 2] = color;
      }
      ctx.putImageData(imgData, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Nie udało się wczytać obrazu'));
    };
  });
}

export async function preprocessImageForOCRFromCanvas(
  sourceCanvas: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  const scaleFactor = 2;
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = sourceCanvas.width * scaleFactor;
  scaledCanvas.height = sourceCanvas.height * scaleFactor;
  const scaledCtx = scaledCanvas.getContext('2d');
  scaledCtx.imageSmoothingEnabled = true;
  scaledCtx.imageSmoothingQuality = 'high';
  scaledCtx.drawImage(sourceCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);

  const imgData = scaledCtx.getImageData(0, 0, scaledCanvas.width, scaledCanvas.height);
  const data = imgData.data;
  const histogram = Array.from({ length: 256 }).fill(0) as number[];
  const luminanceValues: number[] = [];

  for (let i = 0; i < data.length; i += 4) {
    const luminance = Math.round(data[i] * 0.21 + data[i + 1] * 0.72 + data[i + 2] * 0.07);
    luminanceValues.push(luminance);
    histogram[luminance]++;
  }

  const totalPixels = data.length / 4;
  let adaptiveThreshold = calculateOtsuThreshold(histogram, totalPixels);
  const darkPixels = luminanceValues.filter((l) => l < 128).length;
  const isDarkBackground = darkPixels > totalPixels * 0.6;

  adaptiveThreshold = isDarkBackground
    ? Math.min(255, Math.round(adaptiveThreshold * 1.15))
    : Math.max(0, Math.round(adaptiveThreshold * 0.9));
  if (adaptiveThreshold < 50 || adaptiveThreshold > 200) adaptiveThreshold = 140;

  for (let i = 0; i < data.length; i += 4) {
    const b = data[i + 2],
      g = data[i + 1],
      r = data[i];
    const luminance = r * 0.21 + g * 0.72 + b * 0.07;
    const isYellowish = r > adaptiveThreshold && g > adaptiveThreshold && b < r * 0.7;
    const isBrightText = luminance > adaptiveThreshold || isYellowish;
    const color = isBrightText ? 0 : 255;
    data[i] = color;
    data[i + 1] = color;
    data[i + 2] = color;
  }

  scaledCtx.putImageData(imgData, 0, 0);
  return scaledCanvas;
}
