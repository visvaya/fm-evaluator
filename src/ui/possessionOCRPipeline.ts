import { cropImage, preprocessImageForOCRFromCanvas } from '../ocr/ocrImageProcessing';
import { normalizeTextForMatching } from '../ocr/ocrMatching';
import { type OCRResult, parseOCRText, updateReferenceDatabase } from '../ocr/ocrParsing';
import { ocrAreas, ocrSettings } from '../ocr/ocrSettings';
import { ocrWorkerPool } from '../ocr/ocrWorkerPool';
import { getProcessor } from '../lib/processorBridge';
import { displayOCRResults } from './possessionOCRDisplay';
import { renderPossessionClubList } from './possessionClubList';

export async function processWithConcurrencyLimit<T>(
  items: T[],
  limit: number,
  proc: (item: T, index: number) => Promise<any>
): Promise<{ errors: { error: any; index: number }[]; results: { index: number; result: any }[] }> {
  const results: { index: number; result: any }[] = [];
  const errors: { error: any; index: number }[] = [];
  const executing: Promise<any>[] = [];
  const allPromises: Promise<any>[] = [];

  for (const [i, item] of items.entries()) {
    const promise = proc(item, i).then(
      (result) => ({ index: i, result, success: true }),
      (error) => ({ error, index: i, success: false })
    );
    allPromises.push(promise);
    executing.push(promise);
    if (executing.length >= limit) {
      await Promise.race(executing);
      executing.shift();
    }
  }

  const allResults = await Promise.all(allPromises);
  allResults.forEach((item) => {
    if (!item) return;
    const { error, index, result, success } = item;
    if (success && Array.isArray(result)) results.push({ index, result });
    else if (!success) errors.push({ error, index });
  });
  return { errors, results };
}

export async function processPossessionScreenshotWithAreas(
  imageFile: File,
  progressCallback?: (p: { progress: number; status: string }) => void
): Promise<OCRResult[]> {
  if (!ocrAreas.league || !ocrAreas.table)
    throw new Error('Obszary OCR nie są zdefiniowane. Zaznacz obszary najpierw.');

  if (progressCallback) progressCallback({ progress: 5, status: 'Wczytywanie obrazu...' });
  const img = new Image();
  const url = URL.createObjectURL(imageFile);
  await new Promise<void>((resolve, reject) => {
    img.addEventListener('load', () => {
      URL.revokeObjectURL(url);
      resolve();
    });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Nie udało się wczytać obrazu'));
    };
    img.src = url;
  });

  if (progressCallback) progressCallback({ progress: 10, status: 'Przygotowywanie obrazu...' });
  const sourceCanvas = document.createElement('canvas');
  const sourceCtx = sourceCanvas.getContext('2d');
  sourceCanvas.width = img.width;
  sourceCanvas.height = img.height;
  sourceCtx.drawImage(img, 0, 0);

  if (progressCallback) progressCallback({ progress: 15, status: 'Przetwarzanie obszaru ligi...' });
  const leagueCanvas = cropImage(sourceCanvas, ocrAreas.league);
  if (progressCallback)
    progressCallback({ progress: 20, status: 'Przygotowywanie obszaru ligi do OCR...' });
  const leagueProcessed = await preprocessImageForOCRFromCanvas(leagueCanvas);
  if (progressCallback) progressCallback({ progress: 30, status: 'OCR obszaru ligi...' });
  const leagueOCRResult = await ocrWorkerPool.recognize(leagueProcessed);
  const leagueText = leagueOCRResult.data.text;
  const leagueConfidence = leagueOCRResult.confidence || 0;

  if (progressCallback) progressCallback({ progress: 40, status: 'Analiza rozpoznanej ligi...' });
  const detectedLeague = parseOCRText(leagueText, 'league') as string;

  if (progressCallback)
    progressCallback({ progress: 50, status: 'Przetwarzanie obszaru tabeli...' });
  const tableCanvas = cropImage(sourceCanvas, ocrAreas.table);
  if (progressCallback)
    progressCallback({ progress: 55, status: 'Przygotowywanie obszaru tabeli do OCR...' });
  const tableProcessed = await preprocessImageForOCRFromCanvas(tableCanvas);
  if (progressCallback) progressCallback({ progress: 65, status: 'OCR obszaru tabeli...' });
  const tableOCRResult = await ocrWorkerPool.recognize(tableProcessed);
  const tableText = tableOCRResult.data.text;
  const tableConfidence = tableOCRResult.confidence || 0;

  if (progressCallback) progressCallback({ progress: 85, status: 'Dopasowywanie klubów...' });
  const parseResult = parseOCRText(tableText, 'table', detectedLeague || null) as {
    errors: string[];
    league: null | string;
    results: OCRResult[];
  };

  if (progressCallback) progressCallback({ progress: 95, status: 'Walidacja wyników...' });
  if (parseResult.results && Array.isArray(parseResult.results)) {
    parseResult.results.forEach((r) => {
      if (detectedLeague && !r.ocrLeague) r.ocrLeague = detectedLeague;
      r.ocrConfidence = tableConfidence;
      r.leagueConfidence = leagueConfidence;
      if (tableConfidence < (ocrSettings.confidenceThreshold || 60)) r.lowConfidenceWarning = true;
    });
  }

  if (progressCallback) progressCallback({ progress: 100, status: 'Zakończono' });
  return parseResult.results || [];
}

export async function processOCRFiles(files: File[]): Promise<void> {
  if (files.length === 0) return;
  const progressContainer = document.querySelector('#ocr-progress-container');
  const progressBar = document.querySelector('#ocr-progress-bar');
  const progressText = document.querySelector('#ocr-progress-text');
  const errorEl = document.querySelector('#possession-modal-error');

  progressContainer?.classList.remove('hidden');
  document.querySelector('#ocr-preview-container')?.classList.add('hidden');
  if (errorEl) errorEl.textContent = '';

  try {
    updateReferenceDatabase();
    const allResults: OCRResult[] = [];
    const fileErrors: string[] = [];
    const startTime = Date.now();
    const concurrencyLimit = Math.min(ocrSettings.concurrencyLimit || 2, Math.max(1, files.length));

    const processResult = await processWithConcurrencyLimit(
      files,
      concurrencyLimit,
      async (file: File, index: number) => {
        const fileProgress = (index / files.length) * 100;
        if (progressText) progressText.textContent = `Plik ${index + 1}/${files.length}...`;
        let lastError: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            return await processPossessionScreenshotWithAreas(file, ({ progress, status }) => {
              if (progressBar)
                (progressBar as HTMLElement).style.width =
                  `${fileProgress + progress / files.length}%`;
              if (progressText) {
                const elapsed = (Date.now() - startTime) / 1000;
                const eta = Math.ceil((elapsed / (index + 1)) * (files.length - (index + 1)));
                progressText.textContent = `Plik ${index + 1}/${files.length}: ${Math.floor(progress)}%${eta > 0 ? ` (~${eta}s)` : ''}${attempt > 0 ? ` (ponowienie ${attempt})` : ''}`;
              }
            });
          } catch (error: any) {
            lastError = error;
            if (
              attempt < 1 &&
              error.message &&
              (error.message.includes('network') ||
                error.message.includes('timeout') ||
                error.message.includes('Worker'))
            ) {
              await new Promise((resolve) => setTimeout(resolve, 1000));
              continue;
            }
            throw error;
          }
        }
        throw lastError || new Error('Nieznany błąd');
      }
    );

    const { errors: processedErrors, results: processedResults } = processResult;
    processedResults.sort((a, b) => a.index - b.index);
    processedResults.forEach(({ index, result: results }) => {
      if (!Array.isArray(results)) return;
      results.forEach((r: OCRResult) => {
        if (!r) return;
        if (!r.matched && !isNaN(r.possession))
          r.matched = r.correctedOCR || r.original || 'Nieznany klub';
        if (r.matched && !isNaN(r.possession)) {
          r.sourceFile = files[index].name;
          allResults.push(r);
        }
      });
    });
    processedErrors.forEach(({ error, index }) =>
      fileErrors.push(`${files[index].name}: ${error.message}`)
    );

    progressContainer?.classList.add('hidden');

    if (allResults.length === 0) {
      let msg = 'Nie znaleziono żadnych danych w obrazach.';
      msg +=
        fileErrors.length > 0
          ? ` Błędy: ${fileErrors
              .slice(0, 2)
              .join('; ')}${fileErrors.length > 2 ? ` (i ${fileErrors.length - 2} więcej)` : ''}`
          : ' Sprawdź czy obszary OCR są poprawnie zaznaczone i czy obraz zawiera tabelę z posiadaniem.';
      if (errorEl) {
        errorEl.textContent = msg;
        errorEl.className = 'text-[10px] text-red-600 font-mono min-h-[14px]';
      }
      return;
    }

    const deduplicatedResults: OCRResult[] = [];
    const resultsByClub = new Map<string, OCRResult>();
    allResults.forEach((r) => {
      if (!r.matched) return;
      const key = normalizeTextForMatching(r.matched);
      const existing = resultsByClub.get(key);
      if (existing) {
        const existingScore = existing.score || 0,
          newScore = r.score || 0;
        if (
          (r.leagueMatch && !existing.leagueMatch) ||
          (r.leagueMatch === existing.leagueMatch && newScore > existingScore)
        ) {
          const idx = deduplicatedResults.indexOf(existing);
          if (idx !== -1) {
            deduplicatedResults[idx] = r;
            resultsByClub.set(key, r);
          }
        }
      } else {
        resultsByClub.set(key, r);
        deduplicatedResults.push(r);
      }
    });

    displayOCRResults(deduplicatedResults, [], fileErrors, files.length > 1);
    const proc = getProcessor();
    if (proc)
      deduplicatedResults.forEach((r) => {
        if (r.matched && !isNaN(r.possession)) proc.setTeamPossession(r.matched, r.possession);
      });
    renderPossessionClubList('');
    const ocrFileInput = document.querySelector<HTMLInputElement>('#possession-ocr-file');
    if (ocrFileInput) ocrFileInput.value = '';

    const filesInfo = files.length > 1 ? `z ${files.length} plików` : '';
    let successMsg = `Rozpoznano ${allResults.length} klubów ${filesInfo}`;
    if (fileErrors.length > 0)
      successMsg += ` (${fileErrors.length} plik${fileErrors.length === 1 ? '' : 'ów'} z błędami)`;
    successMsg += ' (kliknij "Zapisz" aby zapisać).';
    if (errorEl) {
      errorEl.textContent = successMsg;
      errorEl.className =
        fileErrors.length > 0
          ? 'text-[10px] text-orange-600 font-mono min-h-[14px]'
          : 'text-[10px] text-green-600 font-mono min-h-[14px]';
    }
  } catch (error: any) {
    progressContainer?.classList.add('hidden');
    if (errorEl) {
      errorEl.textContent = `Błąd OCR: ${error.message}`;
      errorEl.className = 'text-[10px] text-red-600 font-mono min-h-[14px]';
    }
  }
}
