import { getFilterRuntime } from '@/lib/filterRuntime';
import { getCurrentLanguage, t } from '@/lib/i18nBridge';
import { scheduleTableRender } from '@/lib/uiBridge';

// Phase 5A: updateUI migrated from main.js (L37-152)
// Also migrates: t(), setLanguage(), detectLanguage() thin wrappers

export function detectLanguage(): string {
  return getCurrentLanguage() ?? 'en';
}

export async function setLanguage(lang: string): Promise<void> {
  if ((window as any).i18n) {
    await (window as any).i18n.setLanguage(lang);

    const languageModal = document.querySelector('#language-choice-modal');
    if (languageModal && !languageModal.classList.contains('hidden'))
      languageModal.classList.add('hidden');
    const languageDropdown = document.querySelector('#language-dropdown');
    if (languageDropdown && !languageDropdown.classList.contains('hidden'))
      languageDropdown.classList.add('hidden');

    if (typeof (window as any).updateUI === 'function') (window as any).updateUI();
  }
}

export function updateUI(): void {
  // Update all elements with data-i18n attribute
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const category = el.dataset.i18nCategory || 'ui';
    if (key) el.textContent = t(key, category);
  });

  // Update all elements with data-i18n-title attribute
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle;
    const category = el.dataset.i18nCategory || 'ui';
    if (key) el.title = t(key, category);
  });

  // Update all elements with data-i18n-placeholder attribute
  document.querySelectorAll<HTMLElement>('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    const category = el.dataset.i18nCategory || 'ui';
    if (key && 'placeholder' in el) {
      (el as HTMLInputElement).placeholder = t(key, category);
    }
  });

  // Update column names (only if COLUMNS is already defined)
  try {
    const COLUMNS = (window as any).COLUMNS;
    if (COLUMNS && Array.isArray(COLUMNS)) {
      COLUMNS.forEach((col: any) => {
        const translatedName = t(col.id, 'columns');
        if (translatedName !== col.id) {
          col.name = translatedName;
        }
        if (col.fullName) {
          const fullKey = `${col.id}_full`;
          const translatedFull = t(fullKey, 'columns');
          if (translatedFull !== fullKey) {
            col.fullName = translatedFull;
          }
        }
      });
      if (typeof (window as any).renderTableHeaders === 'function') {
        (window as any).renderTableHeaders(true);
      }
      scheduleTableRender();
    }
  } catch {
    // COLUMNS not yet initialized, skip
  }

  // Update position select options
  const centralPositionSelect = document.querySelector('#central-position-select');
  [centralPositionSelect].forEach((select) => {
    if (select) {
      [...(select as HTMLSelectElement).options].forEach((option) => {
        const posValue = option.value;
        if (posValue && t(posValue, 'positions') !== posValue) {
          const positionName = t(posValue, 'positions');
          option.textContent = posValue === 'BEST' ? positionName : `${positionName} (${posValue})`;
        }
        if (posValue === '') {
          option.textContent = `-- ${t('select_role', 'ui').split(' ').slice(1).join(' ')} --`;
        }
      });
    }
  });

  // Update engine select options
  const centralEngineSelect = document.querySelector('#central-engine-select');
  [centralEngineSelect].forEach((select) => {
    if (select) {
      [...(select as HTMLSelectElement).options].forEach((option) => {
        const engineValue = option.value;
        if (engineValue && t(engineValue, 'engines') !== engineValue) {
          option.textContent = t(engineValue, 'engines');
        }
      });
    }
  });

  // Update language dropdown active state
  document.querySelectorAll<HTMLButtonElement>('#language-dropdown button').forEach((btn) => {
    const btnLang = btn.dataset.lang;
    if (btnLang === getCurrentLanguage()) {
      btn.classList.add('bg-blue-100', 'font-black');
    } else {
      btn.classList.remove('bg-blue-100', 'font-black');
    }
  });

  // Update results count if displayed
  try {
    const totalRows = getFilterRuntime().calculatedScores.length;
    if (typeof (window as any).updateResultsMeta === 'function' && totalRows >= 0) {
      (window as any).updateResultsMeta(totalRows);
    }
  } catch {
    // runtime not yet initialized
  }

  // Update page info if displayed
  try {
    const store = (window as any).store;
    if (
      typeof (window as any).updatePageInfo === 'function' &&
      store?.currentPage !== undefined &&
      (window as any).maxPage !== undefined
    ) {
      (window as any).updatePageInfo(store.currentPage, (window as any).maxPage);
    }
  } catch {
    // pagination variables not yet initialized
  }
}
