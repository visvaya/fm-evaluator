import { legacyResultActionAttrs } from '@/features/legacyRuntime/legacyActionAttributes';
import { correctCommonOCRErrors } from '../ocr/ocrMatching';
import { type OCRResult } from '../ocr/ocrParsing';
import { useOcrStore } from '../store/useOcrStore';
import { escHtml as esc } from '../utils/escHtml';
import { getProcessor } from '../lib/processorBridge';
import { renderPossessionClubList } from './possessionClubList';

export function formatOCRResult(r: OCRResult, resultIndex: number): string {
  let statusClass = 'text-green-600',
    statusIcon = '&#10003;';
  if (r.lowConfidenceWarning || (r.ocrConfidence !== undefined && r.ocrConfidence < 60)) {
    statusClass = 'text-orange-600';
    statusIcon = '&#9888;&#65039;';
  } else if (r.warning) {
    statusClass = 'text-orange-600';
    statusIcon = '&#9888;&#65039;';
  } else if (r.corrected) {
    statusClass = 'text-blue-600';
    statusIcon = '&#128295;';
  }
  if (!r.leagueMatch && r.ocrLeague) {
    statusClass = 'text-yellow-600';
    statusIcon = '&#9889;';
  }

  const resultId = `ocr-result-${resultIndex || Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  r._resultId = resultId;

  const parts: string[] = [
    `<div class="${statusClass} ml-2 flex items-center justify-between group" id="${esc(resultId)}">`,
    `<div class="flex-1">${statusIcon} ${esc(r.matched)} &rarr; ${r.possession}%`
  ];
  if (r.league) parts.push(` <span class="text-gray-400 text-[8px]">(${esc(r.league)})</span>`);
  if (r.ocrConfidence !== undefined) {
    const confColor =
      r.ocrConfidence >= 80
        ? 'text-green-500'
        : r.ocrConfidence >= 60
          ? 'text-yellow-500'
          : 'text-orange-500';
    parts.push(` <span class="${confColor} text-[8px]">[${r.ocrConfidence.toFixed(0)}%]</span>`);
  }
  if (r.correctedOCR && r.correctedOCR !== r.original)
    parts.push(
      ` <span class="text-blue-400 text-[8px]">(OCR: &quot;${esc(r.original)}&quot; &rarr; &quot;${esc(r.correctedOCR)}&quot;)</span>`
    );
  if (r.correctedOCR && r.matched !== r.correctedOCR)
    parts.push(
      ` <span class="text-purple-400 text-[8px]">(&rarr; &quot;${esc(r.matched)}&quot;)</span>`
    );
  else if (!r.correctedOCR && r.corrected && r.original !== r.matched)
    parts.push(` <span class="text-gray-500 text-[8px]">(z &quot;${esc(r.original)}&quot;)</span>`);
  if (r.warning) parts.push(` <span class="text-orange-500 text-[8px]">(${esc(r.warning)})</span>`);
  if (r.lowConfidenceWarning || (r.ocrConfidence !== undefined && r.ocrConfidence < 60))
    parts.push(` <span class="text-orange-500 text-[8px]">(niska pewno&#347;&#263; OCR)</span>`);
  if (!r.leagueMatch && r.ocrLeague)
    parts.push(
      ` <span class="text-yellow-500 text-[8px]">(liga mo&#380;e si&#281; nie zgadza&#263;)</span>`
    );
  parts.push('</div>');
  parts.push(
    `<button ${legacyResultActionAttrs('editOCRResult', resultId)} class="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 hover:text-blue-800 text-[8px]" title="Edytuj wynik">&#9999;&#65039;</button>`
  );
  parts.push(
    `<button ${legacyResultActionAttrs('removeOCRResult', resultId)} class="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-800 text-[8px]" title="Usu&#324; wynik">&#128465;&#65039;</button>`,
    '</div>'
  );
  return parts.join('');
}

export function displayOCRResults(
  allResults: OCRResult[],
  allErrors: any[],
  fileErrors: string[],
  multipleFiles: boolean
): void {
  useOcrStore.getState().setOcrData(allResults, allErrors, fileErrors);

  const previewContainer = document.querySelector('#ocr-preview-container');
  const previewText = document.querySelector('#ocr-preview-text');
  if (!previewContainer || !previewText) return;

  const parts: string[] = ['<div class="space-y-1">'];

  const detectedLeagues = new Set<string>();
  allResults.forEach((r) => {
    if (r.ocrLeague) detectedLeagues.add(r.ocrLeague);
  });
  if (detectedLeagues.size > 0) {
    const correctedLeagues = [...detectedLeagues].map((l) => esc(correctCommonOCRErrors(l)));
    parts.push(
      `<div class="text-[9px] font-bold text-blue-700 mb-2 pb-1 border-b border-blue-200">Rozpoznana liga: ${correctedLeagues.join(', ')}</div>`
    );
  }

  if (multipleFiles) {
    const resultsByFile: Record<string, OCRResult[]> = {};
    allResults.forEach((r) => {
      if (!resultsByFile[r.sourceFile]) resultsByFile[r.sourceFile] = [];
      resultsByFile[r.sourceFile].push(r);
    });
    let globalIndex = 0;
    Object.entries(resultsByFile).forEach(([fileName, fileResults]) => {
      parts.push(
        `<div class="text-[8px] font-bold text-gray-500 mb-1 mt-2">${esc(fileName)}</div>`
      );
      fileResults.forEach((r) => parts.push(formatOCRResult(r, globalIndex++)));
    });
  } else {
    allResults.forEach((r, index) => parts.push(formatOCRResult(r, index)));
  }

  if (allErrors.length > 0)
    parts.push(
      `<div class="text-gray-400 text-[8px] mt-2">Nie rozpoznano: ${allErrors.length} linii</div>`
    );
  if (fileErrors.length > 0)
    parts.push(
      `<div class="text-red-400 text-[8px] mt-2">Błędy plików: ${fileErrors.length}</div>`
    );
  parts.push('</div>');

  // All dynamic values are HTML-escaped via esc()
  previewText.innerHTML = parts.join('');
  previewContainer.classList.remove('hidden');
}

export function refreshOCRResultsDisplay(): void {
  const { ocrResults, ocrErrors, ocrFileErrors } = useOcrStore.getState();
  if (!ocrResults.length && !ocrErrors.length) return;
  displayOCRResults(
    ocrResults,
    ocrErrors,
    ocrFileErrors,
    new Set(ocrResults.map((r) => r.sourceFile)).size > 1
  );
}

export function editOCRResult(resultId: string): void {
  const result = useOcrStore.getState().ocrResults.find((r) => r._resultId === resultId);
  if (!result) {
    alert('Nie znaleziono wyniku do edycji');
    return;
  }
  const clubName = prompt('Nazwa klubu:', result.matched || '');
  if (clubName === null) return;
  const possessionValue = prompt('Posiadanie piłki (%):', String(result.possession || ''));
  if (possessionValue === null) return;
  const possession = parseFloat(possessionValue);
  if (isNaN(possession) || possession < 0 || possession > 100) {
    alert('Posiadanie musi być liczbą od 0 do 100');
    return;
  }
  const matched = clubName.trim();
  useOcrStore.getState().updateOcrResult(resultId, { matched, possession, manuallyEdited: true });
  refreshOCRResultsDisplay();
  const proc = getProcessor();
  if (proc) proc.setTeamPossession(matched, possession);
  renderPossessionClubList('');
}

export function removeOCRResult(resultId: string): void {
  if (!confirm('Czy na pewno chcesz usunąć ten wynik?')) return;
  const results = useOcrStore.getState().ocrResults;
  const result = results.find((r) => r._resultId === resultId);
  if (!result) return;
  useOcrStore.getState().removeOcrResult(resultId);
  const proc = getProcessor();
  if (proc) proc.removeTeamPossession(result.matched);
  refreshOCRResultsDisplay();
  renderPossessionClubList('');
}
