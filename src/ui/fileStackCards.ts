import { legacyIndexActionAttrs } from '@/features/legacyRuntime/legacyActionAttributes';
import { escapeHtmlAttribute } from '@/utils/escapeHtmlAttribute';

const languageNames: Record<string, string> = {
  da: 'Dansk',
  de: 'Deutsch',
  el: 'Ελληνικά',
  en: 'English',
  'en-us': 'English (US)',
  es: 'Español',
  fr: 'Français',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  nl: 'Nederlands',
  no: 'Norsk',
  pl: 'Polski',
  pt: 'Português',
  ru: 'Русский',
  sv: 'Svenska',
  tr: 'Türkçe',
  zh: '中文'
};

const typeColors: Record<string, string> = {
  attr: 'bg-violet-100 text-violet-800',
  both: 'bg-purple-100 text-purple-800',
  complete: 'bg-green-100 text-green-800',
  stats: 'bg-sky-100 text-sky-800',
  unknown: 'bg-gray-100 text-gray-800'
};

interface FileStackTypeLabels {
  attr: string;
  both: string;
  complete: string;
  stats: string;
  unknown: string;
}

interface FileStackItem {
  detectedLanguage?: string;
  missingOptional?: string[];
  missingRequired?: string[];
  name: string;
  rowCount: number;
  type: string;
}

interface RenderFileStackCardsOptions {
  typeLabels: FileStackTypeLabels;
}

const defaultTypeLabels: FileStackTypeLabels = {
  attr: 'Atrybuty',
  both: 'Niekompletny',
  complete: 'Kompletny',
  stats: 'Statystyki',
  unknown: 'Nieznany'
};

function renderRemapButton(index: number, variant: 'complete' | 'incomplete') {
  const isComplete = variant === 'complete';

  return `<button ${legacyIndexActionAttrs('remapFileHeaders', index)} class="text-xs px-2 py-1 ${isComplete ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-500 hover:bg-blue-600'} text-white rounded transition-colors flex items-center gap-1" title="${isComplete ? 'Sprawdź mapowanie nagłówków' : 'Zmień mapowanie nagłówków'}">
              <i class="fas ${isComplete ? 'fa-check-circle' : 'fa-edit'}"></i>
              <span>${isComplete ? 'Sprawdź mapowanie' : 'Zmień mapowanie'}</span>
          </button>`;
}

function renderMissingBadges(fileMeta: FileStackItem, index: number) {
  const relevantMissingRequired = (fileMeta.missingRequired ?? []).map((header) =>
    escapeHtmlAttribute(header)
  );
  const relevantMissingOptional = (fileMeta.missingOptional ?? []).map((header) =>
    escapeHtmlAttribute(header)
  );

  const isIncomplete = fileMeta.type === 'both';
  const hasMissingRequired = relevantMissingRequired.length > 0;
  const hasMissingOptional = relevantMissingOptional.length > 0;

  if (isIncomplete) {
    const remapButton = renderRemapButton(index, 'incomplete');

    if (hasMissingRequired) {
      return {
        missingOptionalBadges: hasMissingOptional
          ? `<div class="mt-1 text-xs text-yellow-600 font-mono">Brakuje opcjonalnych: ${relevantMissingOptional.join(', ')}</div>`
          : '',
        missingRequiredBadges: `<div class="mt-2 flex items-center gap-2 flex-wrap">
                      <span class="text-xs text-red-600 font-mono">Brakuje kluczowych: ${relevantMissingRequired.join(', ')}</span>
                      ${remapButton}
                  </div>`
      };
    }

    if (hasMissingOptional) {
      return {
        missingOptionalBadges: `<div class="mt-2 flex items-center gap-2 flex-wrap">
                      <span class="text-xs text-yellow-600 font-mono">Brakuje opcjonalnych: ${relevantMissingOptional.join(', ')}</span>
                      ${remapButton}
                  </div>`,
        missingRequiredBadges: ''
      };
    }

    return {
      missingOptionalBadges: '',
      missingRequiredBadges: `<div class="mt-2 flex items-center gap-2 flex-wrap">
                    <span class="text-xs text-gray-600 font-mono italic">Plik niekompletny - brakuje niektórych kolumn</span>
                    ${remapButton}
                </div>`
    };
  }

  if (fileMeta.type === 'complete') {
    return {
      missingOptionalBadges: '',
      missingRequiredBadges: `<div class="mt-2 flex items-center gap-2 flex-wrap">
                    ${renderRemapButton(index, 'complete')}
                </div>`
    };
  }

  return {
    missingOptionalBadges: hasMissingOptional
      ? `<div class="mt-1 text-xs text-yellow-600 font-mono">Brakuje opcjonalnych: ${relevantMissingOptional.join(', ')}</div>`
      : '',
    missingRequiredBadges: hasMissingRequired
      ? `<div class="mt-2 text-xs text-red-600 font-mono">Brakuje kluczowych: ${relevantMissingRequired.join(', ')}</div>`
      : ''
  };
}

function renderFileStackCard(
  fileMeta: FileStackItem,
  index: number,
  typeLabels: FileStackTypeLabels
) {
  const typeLabel = typeLabels[fileMeta.type as keyof FileStackTypeLabels] ?? fileMeta.type;
  const typeColor = typeColors[fileMeta.type] ?? 'bg-gray-100 text-gray-800';
  const detectedLang = fileMeta.detectedLanguage ?? 'en';
  const languageName = languageNames[detectedLang] ?? detectedLang.toUpperCase();
  const fileNumber = index + 1;
  const { missingOptionalBadges, missingRequiredBadges } = renderMissingBadges(fileMeta, index);

  return `
              <div class="file-card bg-white border-2 border-gray-200 rounded-lg p-3 flex items-start justify-between hover:border-blue-400 transition-all" data-file-index="${index}">
                  <div class="flex items-start gap-3 flex-1">
                      <div class="w-8 h-8 bg-gray-100 rounded flex items-center justify-center flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 drag-handle" draggable="true">
                          <i class="fas fa-bars text-sm"></i>
                      </div>
                      <div class="w-10 h-10 bg-gray-100 rounded flex items-center justify-center flex-shrink-0 relative">
                          <span class="absolute -top-1 -left-1 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center z-10">${fileNumber}</span>
                          <i class="fas fa-file-csv text-gray-600"></i>
                      </div>
                      <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2 mb-1">
                              <span class="text-sm font-bold text-ink truncate">${escapeHtmlAttribute(fileMeta.name)}</span>
                              <span class="px-2 py-0.5 text-xs font-bold rounded ${typeColor}">${escapeHtmlAttribute(typeLabel)}</span>
                          </div>
                          <div class="text-xs text-gray-500 font-mono">${fileMeta.rowCount} zawodników, ${escapeHtmlAttribute(languageName)}</div>
                          ${missingRequiredBadges}
                          ${missingOptionalBadges}
                      </div>
                  </div>
                  <button ${legacyIndexActionAttrs('removeFileFromStack', index)} class="ml-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1 transition-colors" title="Usuń plik">
                      <i class="fas fa-times"></i>
                  </button>
              </div>
          `;
}

export function renderFileStackCards(
  fileStack: FileStackItem[],
  options: Partial<RenderFileStackCardsOptions> = {}
) {
  const typeLabels = options.typeLabels ?? defaultTypeLabels;
  return fileStack
    .map((fileMeta, index) => renderFileStackCard(fileMeta, index, typeLabels))
    .join('');
}

export const fileStackTypeLabels = {
  default: defaultTypeLabels,
  modal: {
    attr: 'Atrybuty',
    both: 'Oba',
    complete: 'Komplet',
    stats: 'Statystyki',
    unknown: 'Nieznany'
  }
} as const;
