import i18n from './i18n';
import { setupScrollInput } from './ui/filters';

export function bootstrapUI() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      bindLanguageButton();
      refreshUITranslations();
      bindSettingsEnterKey();
      bindModalBackdropListeners();
      bindSettingsScrollInputs();
    });
  } else {
    bindLanguageButton();
    refreshUITranslations();
    bindSettingsEnterKey();
    bindModalBackdropListeners();
    bindSettingsScrollInputs();
  }
}

function bindLanguageButton() {
  const ids = ['language-btn-header'];
  const dropdown = document.querySelector('#language-dropdown');
  if (!dropdown) {
    return;
  }

  ids.forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const isHidden = dropdown.classList.contains('hidden');

      if (isHidden) {
        // Pass the clicked button to trigger correct positioning
        if (typeof (window as any).toggleLanguageDropdown === 'function') {
          (window as any).toggleLanguageDropdown(btn);
        } else {
          dropdown.classList.remove('hidden');
        }

        // Render content if showing
        i18n.renderLanguageDropdown('language-dropdown');
      } else {
        if (typeof (window as any).toggleLanguageDropdown === 'function') {
          (window as any).toggleLanguageDropdown(btn);
        } else {
          dropdown.classList.add('hidden');
        }
      }
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    // Only close if NOT hidden to avoid spam
    if (!dropdown.classList.contains('hidden')) {
      dropdown.classList.add('hidden');
    }
  });
}

function bindModalBackdropListeners() {
  ['settings-modal', 'columns-modal', 'possession-modal'].forEach((id) => {
    document.getElementById(id)?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) (e.currentTarget as HTMLElement).classList.add('hidden');
    });
  });
}

function bindSettingsEnterKey() {
  const ids = [
    'setting-percentile',
    'setting-min-minutes',
    'setting-max-beeswarm-players',
    'setting-penalty-xg-factor'
  ];
  const save = (window as any).saveSettingsAction;
  if (typeof save !== 'function') return;
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') save();
    });
  });
}

function bindSettingsScrollInputs() {
  setupScrollInput('setting-percentile', 1, 0);
  setupScrollInput('setting-min-minutes', 1, 0);
  setupScrollInput('setting-max-beeswarm-players', 1, 0);
}

function refreshUITranslations() {
  i18n.applyToDom();

  // Legacy cleanup if needed
  if (typeof (window as any).updateUI === 'function') {
    (window as any).updateUI();
  }
}

(window as any).debugLanguage = () => {
  const btn = document.querySelector('#language-btn-header');
  const dd = document.querySelector('#language-dropdown');
  console.log('[Debug] Button:', btn);
  console.log('[Debug] Dropdown:', dd);

  if (btn) {
    const listeners = (window as any).getEventListeners(btn); // specific to Chrome DevTools, might not work in standard JS, but good if they use Chrome.
    // actually standard JS can't inspect listeners easily.
    console.log('[Debug] Dispatching click event...');
    (btn as HTMLElement).click();
  }

  if (dd) {
    console.log('[Debug] Dropdown classes:', dd.className);
    console.log('[Debug] Dropdown z-index:', window.getComputedStyle(dd).zIndex);
    console.log('[Debug] Dropdown display:', window.getComputedStyle(dd).display);
    console.log('[Debug] Dropdown visibility:', window.getComputedStyle(dd).visibility);
    const rect = dd.getBoundingClientRect();
    console.log('[Debug] Dropdown rect:', rect);
  }
};
