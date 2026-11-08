// Phase 5A: showLanguageChoiceModal + continueFileProcessing migrated from main.js (L191-381)

import { setLanguage } from '../i18n/updateUi';
import { getCurrentLanguage, t, tNested } from '../lib/i18nBridge';
import { continueImportFlowProcessing } from '../lib/legacyActionBridge';
import { getProcessor } from '../lib/processorBridge';
import { useTableStore } from '../store/useTableStore';

let pendingFileProcessing: ((selectedLang: string) => void) | null = null;

export function continueFileProcessing(): void {
  const processor = getProcessor();
  const els = (window as any).els;
  const { setImportStatus } = useTableStore.getState();

  if (typeof (window as any).renderFileStack === 'function') {
    (window as any).renderFileStack();
  }

  const errors: string[] = [];
  const hasAttributes = processor?.attributes?.length > 0;
  const hasStats = processor?.stats?.length > 0;

  if (errors.length > 0) {
    setImportStatus({
      canRetry: false,
      details: errors,
      kind: 'error',
      message: t('errors_occurred')
    });
  } else {
    if (hasAttributes || hasStats) {
      const promptText = document.querySelector('#single-type-prompt-text');

      const lastFile = processor?.fileStack?.length > 0 ? processor.fileStack[0] : null;

      const statusMsg = (() => {
        if (lastFile) {
          const fileName = lastFile.name ?? 'plik';
          const fileType = lastFile.type ?? 'unknown';
          const rowCount = lastFile.rowCount ?? 0;

          const typeLabels: Record<string, string> = {
            attr: 'Atrybuty',
            both: 'Niekompletny',
            complete: 'Kompletny',
            stats: 'Statystyki',
            unknown: 'Nieznany'
          };
          const typeLabel = typeLabels[fileType] ?? fileType;
          return `Wczytano: ${fileName} (${typeLabel}, ${rowCount} zawodników)`;
        }

        if (hasAttributes && hasStats) {
          return 'Wczytano kompletne dane (Atrybuty + Statystyki).';
        }

        return hasAttributes ? 'Wczytano Atrybuty.' : 'Wczytano Statystyki.';
      })();

      if (hasAttributes && hasStats) {
        if (promptText) promptText.textContent = 'Możesz przejść dalej lub dodać więcej plików.';
      } else if (hasAttributes) {
        if (promptText)
          promptText.textContent = 'Uwaga: Wyniki nie będą kompletne. Brak score statystycznego.';
      } else if (promptText) {
        promptText.textContent = 'Uwaga: Wyniki nie będą kompletne. Brak score atrybutowego.';
      }

      setImportStatus({
        canRetry: false,
        details: [],
        kind: 'success',
        message: statusMsg
      });
    } else {
      setImportStatus({
        canRetry: false,
        details: [t('missing_both_data')],
        kind: 'error',
        message: t('missing_both_data')
      });
    }
    document.querySelector('#single-type-prompt')?.classList.add('hidden');
  }
  if (els?.fileInput) els.fileInput.value = '';
  continueImportFlowProcessing();
}

export function showLanguageChoiceModal(fileLang: string, uiLang: string): void {
  const modal = document.querySelector('#language-choice-modal');
  const title = document.querySelector('#language-choice-title');
  const message = document.querySelector('#language-choice-message');
  const question = document.querySelector('#language-choice-question');
  const uiBtn = document.querySelector('#language-choice-ui-btn');
  const fileBtn = document.querySelector('#language-choice-file-btn');
  const rememberCheckbox = document.querySelector('#language-choice-remember');

  if (!modal || !title || !message || !question || !uiBtn || !fileBtn) return;

  const uiLangName = tNested('language_names', uiLang, 'ui');
  const fileLangName = tNested('language_names', fileLang, 'ui');

  title.textContent = t('language_choice_title');
  message.textContent = t('language_choice_message', 'ui', {
    fileLang: fileLangName,
    uiLang: uiLangName
  });
  question.textContent = t('language_choice_question');
  uiBtn.textContent = t('language_choice_ui', 'ui', { uiLang: uiLangName });
  fileBtn.textContent = t('language_choice_file', 'ui', { fileLang: fileLangName });

  // Synchronize checkbox with settings
  if (rememberCheckbox) {
    const rememberEnabled =
      localStorage.getItem('fm24-evaluator-remember-language-choice') === 'true';
    (rememberCheckbox as HTMLInputElement).checked = rememberEnabled;
  }

  // Store continuation function
  pendingFileProcessing = function (selectedLang: string) {
    if (selectedLang !== (getCurrentLanguage() ?? 'en')) {
      void setLanguage(selectedLang);
    }

    const shouldRemember = (rememberCheckbox as HTMLInputElement)?.checked;
    const rememberEnabled =
      localStorage.getItem('fm24-evaluator-remember-language-choice') === 'true';

    if (shouldRemember && rememberEnabled) {
      try {
        localStorage.setItem('fm24-evaluator-file-language-choice', selectedLang);
      } catch (error) {
        console.warn('Could not save language choice:', error);
      }
    } else {
      try {
        sessionStorage.setItem('fm24-evaluator-file-language-choice', selectedLang);
      } catch (error) {
        console.warn('Could not save language choice to session:', error);
      }
    }

    continueFileProcessing();
  };

  // Setup button handlers
  uiBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    if (pendingFileProcessing) pendingFileProcessing(uiLang);
    pendingFileProcessing = null;
  });

  fileBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    if (pendingFileProcessing) pendingFileProcessing(fileLang);
    pendingFileProcessing = null;
  });

  modal.classList.remove('hidden');
}
