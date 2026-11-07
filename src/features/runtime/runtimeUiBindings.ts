import i18n from '@/i18n';
import { createFocusTrap, type FocusTrap } from '@/ui/focusTrap';

let activeModalTrap: FocusTrap | null = null;

function toggleLanguageDropdown(triggerElement?: HTMLElement) {
  const dropdown = document.querySelector('#language-dropdown');
  let languageButton = triggerElement;

  if (!languageButton) {
    const headerButton = document.querySelector('#language-btn-header');
    languageButton = headerButton as HTMLElement;
  }

  if (!dropdown || !languageButton) return;

  const isHidden = dropdown.classList.contains('hidden');
  if (isHidden) {
    const rect = languageButton.getBoundingClientRect();
    (dropdown as HTMLElement).style.top = `${rect.bottom + window.scrollY + 8}px`;
    (dropdown as HTMLElement).style.right = `${window.innerWidth - rect.right}px`;
    dropdown.classList.remove('hidden');
  } else {
    dropdown.classList.add('hidden');
  }
}

export function installLanguageBindings() {
  (window as any).toggleLanguageDropdown = toggleLanguageDropdown;

  i18n.renderLanguageDropdown('language-dropdown');

  i18n.onLocaleChange((locale) => {
    if ((window as any).CURRENT_LANGUAGE !== undefined) {
      (window as any).CURRENT_LANGUAGE = locale;
    }

    if (typeof (window as any).updateUI === 'function') {
      try {
        (window as any).updateUI();
      } catch (error) {
        console.warn('[i18n] Legacy updateUI failed:', error);
      }
    }

    i18n.renderLanguageDropdown('language-dropdown');
  });
}

export function getActiveModalTrap() {
  return activeModalTrap;
}

export function setupSettingsModalFocusTrap() {
  const modal = document.querySelector('#settings-modal');
  const openButton = document.querySelector('#settings-btn');
  const closeButton = document.querySelector('#close-settings');
  if (!modal || !openButton || !closeButton) return;

  const activate = () => {
    if (activeModalTrap) {
      try {
        activeModalTrap.deactivate();
      } catch {
        // Ignore deactivation errors from stale traps.
      }
      activeModalTrap = null;
    }

    try {
      activeModalTrap = createFocusTrap(modal as HTMLElement, {
        escapeDeactivates: true,
        initialFocus: '#setting-percentile',
        onDeactivate: () => {
          activeModalTrap = null;
        },
        onEscape: () => {
          modal.classList.add('hidden');
        },
        returnFocus: true
      });
      activeModalTrap.activate();
    } catch (error) {
      console.warn('[SettingsModal] Focus trap init failed', error);
    }
  };

  const deactivate = () => {
    if (!activeModalTrap) return;

    try {
      activeModalTrap.deactivate();
    } catch (error) {
      console.warn('[SettingsModal] Focus trap deactivate failed', error);
    } finally {
      activeModalTrap = null;
    }
  };

  openButton.addEventListener('click', () => {
    if (!modal.classList.contains('hidden')) {
      activate();
    }
  });

  closeButton.addEventListener('click', () => {
    if (modal.classList.contains('hidden')) {
      deactivate();
    }
  });

  const observer = new MutationObserver(() => {
    if (modal.classList.contains('hidden')) {
      deactivate();
    }
  });
  observer.observe(modal, { attributeFilter: ['class'], attributes: true });
}

export function setupPossessionModalFocusTrap(): void {
  const modal = document.querySelector('#possession-modal');
  if (!modal) return;

  let activePossessionTrap: FocusTrap | null = null;

  const activate = () => {
    if (activePossessionTrap) {
      try {
        activePossessionTrap.deactivate();
      } catch {
        // Ignore deactivation errors from stale traps.
      }
      activePossessionTrap = null;
    }

    try {
      activePossessionTrap = createFocusTrap(modal as HTMLElement, {
        escapeDeactivates: true,
        initialFocus: '#possession-default-value',
        onDeactivate: () => {
          activePossessionTrap = null;
        },
        onEscape: () => {
          modal.classList.add('hidden');
        },
        returnFocus: true
      });
      activePossessionTrap.activate();
    } catch (error) {
      console.warn('[PossessionModal] Focus trap init failed', error);
    }
  };

  const deactivate = () => {
    if (!activePossessionTrap) return;

    try {
      activePossessionTrap.deactivate();
    } catch (error) {
      console.warn('[PossessionModal] Focus trap deactivate failed', error);
    } finally {
      activePossessionTrap = null;
    }
  };

  const observer = new MutationObserver(() => {
    if (modal.classList.contains('hidden')) {
      deactivate();
    } else {
      activate();
    }
  });
  observer.observe(modal, { attributeFilter: ['class'], attributes: true });
}
